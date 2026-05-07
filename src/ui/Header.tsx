import { Divider, Flex } from "antd";
import { MINECRAFT_VERSION } from "../logic/MinecraftApi";
import { SettingsModalButton } from "./SettingsModal";
import { JarDecompilerModalButton } from "./JarDecompilerModal";

const Header = () => {
    return (
        <div>
            <Flex style={{ width: "100%", paddingTop: 8 }}>
                <div style={{ width: "100%", minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
                    <HeaderBody />
                </div>
            </Flex>
            <Divider size="small" />
        </div>
    );
};

const HeaderBody = () => {
    return (
        <Flex justify="center" align="center" gap={6} style={{ width: "max-content", minWidth: "100%" }}>
            <div style={{ flex: "0 0 auto", fontWeight: 500, padding: "4px 12px" }}>
                Minecraft {MINECRAFT_VERSION}
            </div>
            <div style={{ flex: "0 0 auto" }}>
                <JarDecompilerModalButton />
            </div>
            <div style={{ flex: "0 0 auto" }}>
                <SettingsModalButton />
            </div>
        </Flex>
    );
};

export default Header;
