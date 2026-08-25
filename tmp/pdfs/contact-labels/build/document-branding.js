"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentBranding = void 0;
exports.documentLogoPath = documentLogoPath;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
exports.documentBranding = {
    brandName: "payveo",
    companyDisplayName: "payveo",
    primaryColor: "#007FC5",
    mutedLineColor: "#A8CDE3",
    logoWidth: 118,
};
function documentLogoPath() {
    const source = (0, node_path_1.join)(process.cwd(), "src", "assets", "branding", "payveo-logo-primary-flat.png");
    if ((0, node_fs_1.existsSync)(source))
        return source;
    const workspace = (0, node_path_1.join)(process.cwd(), "apps", "api", "src", "assets", "branding", "payveo-logo-primary-flat.png");
    if ((0, node_fs_1.existsSync)(workspace))
        return workspace;
    return (0, node_path_1.join)(process.cwd(), "dist", "assets", "branding", "payveo-logo-primary-flat.png");
}
