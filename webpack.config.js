const path = require("path");
const glob = require("glob");
const CopyPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

// create a new json obj for the entries allowing us to have nested files in the bundle
const frontendEntries = Object.fromEntries(
	glob.sync("./src/frontend/**/*.ts{,x}").map((file) => {
		const relativePath = file.replace("src/", "").replace(/\.tsx?$/, "");
		return [relativePath, "./" + file];
	})
);

const entries = {
	...frontendEntries,
	background: "./src/background.ts",
	popup: "./src/popup.ts",
	execute: "./src/execute.ts",
};

module.exports = {
	mode: "production",
	entry: entries,
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js",
	},
	resolve: {
		extensions: [".ts", ".js", ".tsx", ".jsx"],
		alias: {
			"@": path.resolve(__dirname, "src/frontend"),
		},
	},
	module: {
		rules: [
			// process ts files with ts-loader
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
			// load md files raw
			{
				test: /\.md$/,
				use: "raw-loader",
			},
			// load css file and apply tailwind
			{
				test: /\.css$/,
				use: ["style-loader", "css-loader", "postcss-loader"],
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
			],
		}),
	],
};
