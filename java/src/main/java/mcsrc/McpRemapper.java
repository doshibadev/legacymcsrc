package mcsrc;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Label;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;
import org.objectweb.asm.commons.ClassRemapper;
import org.objectweb.asm.commons.Remapper;
import org.teavm.jso.typedarrays.ArrayBuffer;
import org.teavm.jso.typedarrays.Int8Array;

import java.util.*;

public class McpRemapper {
    private static final Map<String, String> classMap = new HashMap<>();
    private static final Map<String, String> reverseClassMap = new HashMap<>();
    private static final Map<String, String> fieldSrgMap = new HashMap<>();
    private static final Map<String, String> methodSrgMap = new HashMap<>();
    private static final Map<String, String> methodHumanMap = new HashMap<>();
    private static final Map<String, String> fieldHumanMap = new HashMap<>();
    private static final Map<String, String> paramHumanMap = new HashMap<>();

    private static final Map<String, ClassNode> classNodes = new HashMap<>();

    private static class ClassNode {
        String superName;
        String[] interfaces;
    }

    public static void loadSrg(String srgText) {
        for (String line : srgText.split("\n")) {
            if (line.isEmpty()) continue;
            String[] parts = line.split(" ");
            if (parts.length < 3) continue;
            switch (parts[0]) {
                case "CL:" -> {
                    classMap.put(parts[1], parts[2]);
                    reverseClassMap.put(parts[2], parts[1]);
                }
                case "FD:" -> fieldSrgMap.put(parts[1], parts[2]);
                case "MD:" -> {
                    if (parts.length >= 5) {
                        String key = parts[1] + " " + parts[2];
                        String val = parts[3] + " " + parts[4];
                        methodSrgMap.put(key, val);
                    }
                }
                default -> { }
            }
        }
    }

    public static void loadMethodCsv(String csv) {
        loadCsv(csv, methodHumanMap);
    }

    public static void loadFieldCsv(String csv) {
        loadCsv(csv, fieldHumanMap);
    }

    public static void loadParamCsv(String csv) {
        loadCsv(csv, paramHumanMap);
    }

    private static void loadCsv(String csv, Map<String, String> dest) {
        String[] lines = csv.split("\n");
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i];
            if (line.isEmpty()) continue;
            int firstComma = line.indexOf(',');
            if (firstComma < 0) continue;
            int secondComma = line.indexOf(',', firstComma + 1);
            if (secondComma < 0) continue;
            String searge = line.substring(0, firstComma);
            String name = line.substring(firstComma + 1, secondComma);
            dest.put(searge, name);
        }
    }

    public static void prepass(ArrayBuffer classBytes) {
        byte[] bytes = new Int8Array(classBytes).copyToJavaArray();
        ClassReader reader = new ClassReader(bytes);
        ClassNode node = new ClassNode();
        node.superName = reader.getSuperName();
        node.interfaces = reader.getInterfaces();
        classNodes.put(reader.getClassName(), node);
    }

    public static ArrayBuffer remap(ArrayBuffer classBytes) {
        byte[] bytes = new Int8Array(classBytes).copyToJavaArray();
        ClassReader reader = new ClassReader(bytes);
        ClassWriter writer = new SafeClassWriter(0);
        ClassRemapper classRemapper = new McpClassRemapper(writer, new McpAsmRemapper());
        reader.accept(classRemapper, 0);
        byte[] out = writer.toByteArray();
        Int8Array array = new Int8Array(out.length);
        for (int i = 0; i < out.length; i++) {
            array.set(i, out[i]);
        }
        return array.getBuffer();
    }

    public static String remapInternalName(String internalName) {
        return classMap.getOrDefault(internalName, internalName);
    }

    private static class SafeClassWriter extends ClassWriter {
        SafeClassWriter(int flags) { super(flags); }

        @Override
        protected String getCommonSuperClass(String type1, String type2) {
            if (type1.equals(type2)) return type1;
            if (isAssignable(type1, type2)) return type1;
            if (isAssignable(type2, type1)) return type2;
            String cur = type1;
            while (cur != null) {
                if (isAssignable(cur, type2)) return cur;
                ClassNode node = classNodes.get(cur);
                if (node == null) break;
                cur = node.superName;
            }
            return "java/lang/Object";
        }

        private boolean isAssignable(String sub, String sup) {
            if (sub.equals(sup)) return true;
            if (sup.equals("java/lang/Object")) return true;
            String cur = sub;
            while (cur != null) {
                if (cur.equals(sup)) return true;
                ClassNode node = classNodes.get(cur);
                if (node == null) return false;
                if (node.interfaces != null) {
                    for (String iface : node.interfaces) {
                        if (isAssignable(iface, sup)) return true;
                    }
                }
                cur = node.superName;
            }
            return false;
        }
    }

    private static class McpClassRemapper extends ClassRemapper {
        private String owner;

        McpClassRemapper(ClassWriter writer, Remapper remapper) {
            super(writer, remapper);
        }

        @Override
        public void visit(int version, int access, String name, String signature, String superName, String[] interfaces) {
            owner = name;
            super.visit(version, access, name, signature, superName, interfaces);
        }

        @Override
        public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
            MethodVisitor methodVisitor = super.visitMethod(access, name, descriptor, signature, exceptions);
            if (methodVisitor == null || name.equals("<clinit>") || (access & (Opcodes.ACC_ABSTRACT | Opcodes.ACC_NATIVE)) != 0) {
                return methodVisitor;
            }

            String[] parameterNames = mappedParameterNames(owner, name, descriptor, access);
            if (parameterNames.length == 0) {
                return methodVisitor;
            }

            return new ParameterNameMethodVisitor(Opcodes.ASM9, methodVisitor, access, descriptor, parameterNames);
        }
    }

    private static String[] mappedParameterNames(String owner, String name, String descriptor, int access) {
        String srgName = null;
        if (!name.equals("<init>")) {
            String srg = methodSrgMap.get(owner + "/" + name + " " + descriptor);
            if (srg == null) {
                return new String[0];
            }

            int spaceIdx = srg.indexOf(' ');
            String srgFull = spaceIdx >= 0 ? srg.substring(0, spaceIdx) : srg;
            int slash = srgFull.lastIndexOf('/');
            srgName = slash >= 0 ? srgFull.substring(slash + 1) : srgFull;
        }

        String methodId = methodIdFromSrgName(srgName);
        if (methodId == null) {
            return new String[0];
        }

        Type[] args = Type.getArgumentTypes(descriptor);
        boolean isStatic = (access & Opcodes.ACC_STATIC) != 0;
        String[] names = new String[args.length];

        for (int i = 0; i < args.length; i++) {
            int paramNumber = isStatic ? i : i + 1;
            String mappedName = paramHumanMap.get("p_" + methodId + "_" + paramNumber + "_");
            names[i] = mappedName != null && !mappedName.isEmpty() ? mappedName : null;
        }

        return hasAny(names) ? names : new String[0];
    }

    private static String methodIdFromSrgName(String srgName) {
        if (srgName == null || !srgName.startsWith("func_")) {
            return null;
        }

        int start = "func_".length();
        int end = srgName.indexOf('_', start);
        if (end < 0) {
            return null;
        }

        return srgName.substring(start, end);
    }

    private static boolean hasAny(String[] values) {
        for (String value : values) {
            if (value != null) {
                return true;
            }
        }

        return false;
    }

    private static class ParameterNameMethodVisitor extends MethodVisitor {
        private final int access;
        private final String descriptor;
        private final String[] parameterNames;
        private final Label start = new Label();
        private final Label end = new Label();
        private boolean visitedCode = false;

        ParameterNameMethodVisitor(int api, MethodVisitor methodVisitor, int access, String descriptor, String[] parameterNames) {
            super(api, methodVisitor);
            this.access = access;
            this.descriptor = descriptor;
            this.parameterNames = parameterNames;
        }

        @Override
        public void visitCode() {
            super.visitCode();
            visitedCode = true;
            super.visitLabel(start);
        }

        @Override
        public void visitMaxs(int maxStack, int maxLocals) {
            if (visitedCode) {
                super.visitLabel(end);
                emitParameterLocals();
            }

            super.visitMaxs(maxStack, maxLocals);
        }

        private void emitParameterLocals() {
            Type[] args = Type.getArgumentTypes(descriptor);
            int localIndex = (access & Opcodes.ACC_STATIC) != 0 ? 0 : 1;

            for (int i = 0; i < args.length; i++) {
                String paramName = parameterNames[i];
                Type arg = args[i];
                if (paramName != null) {
                    super.visitLocalVariable(paramName, arg.getDescriptor(), null, start, end, localIndex);
                }

                localIndex += arg.getSize();
            }
        }
    }

    private static class McpAsmRemapper extends Remapper {
        @Override
        public String map(String internalName) {
            return classMap.getOrDefault(internalName, internalName);
        }

        @Override
        public String mapFieldName(String owner, String name, String descriptor) {
            owner = unmapInternalName(owner);
            String resolved = resolveFieldOwner(owner, name);
            String key = resolved + "/" + name;
            String srg = fieldSrgMap.get(key);
            if (srg == null) return name;
            int slash = srg.lastIndexOf('/');
            String srgName = slash >= 0 ? srg.substring(slash + 1) : srg;
            return fieldHumanMap.getOrDefault(srgName, srgName);
        }

        @Override
        public String mapMethodName(String owner, String name, String descriptor) {
            if (name.equals("<init>") || name.equals("<clinit>")) return name;
            owner = unmapInternalName(owner);
            descriptor = unmapDescriptor(descriptor);
            String resolved = resolveMethodOwner(owner, name, descriptor);
            String key = resolved + "/" + name + " " + descriptor;
            String srg = methodSrgMap.get(key);
            if (srg == null) return name;
            int spaceIdx = srg.indexOf(' ');
            String srgFull = spaceIdx >= 0 ? srg.substring(0, spaceIdx) : srg;
            int slash = srgFull.lastIndexOf('/');
            String srgName = slash >= 0 ? srgFull.substring(slash + 1) : srgFull;
            return methodHumanMap.getOrDefault(srgName, srgName);
        }

        private String resolveFieldOwner(String owner, String name) {
            String cur = owner;
            while (cur != null) {
                if (fieldSrgMap.containsKey(cur + "/" + name)) return cur;
                ClassNode node = classNodes.get(cur);
                if (node == null) break;
                if (node.interfaces != null) {
                    for (String iface : node.interfaces) {
                        String r = resolveFieldOwner(iface, name);
                        if (fieldSrgMap.containsKey(r + "/" + name)) return r;
                    }
                }
                cur = node.superName;
            }
            return owner;
        }

        private String resolveMethodOwner(String owner, String name, String desc) {
            String cur = owner;
            while (cur != null) {
                if (methodSrgMap.containsKey(cur + "/" + name + " " + desc)) return cur;
                ClassNode node = classNodes.get(cur);
                if (node == null) break;
                if (node.interfaces != null) {
                    for (String iface : node.interfaces) {
                        String r = resolveMethodOwner(iface, name, desc);
                        if (methodSrgMap.containsKey(r + "/" + name + " " + desc)) return r;
                    }
                }
                cur = node.superName;
            }
            return owner;
        }

        private String unmapInternalName(String internalName) {
            return reverseClassMap.getOrDefault(internalName, internalName);
        }

        private String unmapDescriptor(String descriptor) {
            StringBuilder result = new StringBuilder(descriptor.length());
            for (int i = 0; i < descriptor.length(); i++) {
                char c = descriptor.charAt(i);
                if (c != 'L') {
                    result.append(c);
                    continue;
                }

                int end = descriptor.indexOf(';', i);
                if (end < 0) {
                    result.append(descriptor.substring(i));
                    break;
                }

                String mappedName = descriptor.substring(i + 1, end);
                result.append('L').append(unmapInternalName(mappedName)).append(';');
                i = end;
            }
            return result.toString();
        }
    }
}
