// vite.config.ts
import { defineConfig } from "vite";
import path from "path";
import { glob } from "glob";
import dotenv from "dotenv";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

dotenv.config({ override: true });

const frontendEntries = Object.fromEntries(
	glob.sync("./src/frontend/**/*.ts{,x}").map((file) => {
		const relativePath = file.replace("src/", "").replace(/\.tsx?$/, "");
		return [relativePath, path.resolve(__dirname, file)];
	})
);

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src/frontend"),
		},
		extensions: [".ts", ".tsx", ".js", ".jsx"],
	},
	plugins: [tailwindcss()],
	build: {
		outDir: "dist",
		sourcemap: true,
		rollupOptions: {
			input: {
				...frontendEntries,
				background: path.resolve(__dirname, "src/background.ts"),
				context: path.resolve(__dirname, "src/context.js"),
				execute: path.resolve(__dirname, "src/execute.ts"),
				popup: path.resolve(__dirname, "src/popup.html"),
			},
			output: {
				entryFileNames: `[name].js`,
			},
		},
	},
});
