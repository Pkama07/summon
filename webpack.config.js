const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
	mode: "production",
	entry: {
		background: "./src/background.ts",
		popup: "./src/popup.ts",
	},
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js",
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			// process ts files with ts-loader
			{
				test: /\.ts$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
		],
	},
	plugins: [
		new Dotenv({
			systemvars: true,
		}),
		new CleanWebpackPlugin(),
		new CopyPlugin({
			patterns: [
				{ from: "manifest.json", to: "." },
				{ from: "src/popup.html", to: "." },
				{ from: "src/summon.png", to: "." },
				{
					from: "src/context.js",
					to: ".",
					force: true,
				},
				{ from: "sys_prompt.md", to: "." },
			],
		}),
	],
};
