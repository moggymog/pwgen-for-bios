const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { DefinePlugin } = require('webpack');
const { exec } = require('child_process');
const Terser = require('terser-webpack-plugin');
const fs = require('fs');


class VersionInfoPlugin {
    constructor(options = {}) {
        if (options.filename === undefined) {
            throw new Error('[VersionInfoPlugin] filename should be set');
        }
        this.options = options;
    }

    apply(compiler) {
        const plugin = { name: 'VersionInfoPlugin' };
        compiler.hooks.afterEmit.tapAsync(plugin, (compilation, callback) => {
            const gitDir = path.join(compiler.context, '.git');

            fs.access(gitDir, fs.constants.F_OK, (dirErr) => {
                if (dirErr) {
                    console.error('Not a git repository or git not installed.');
                    callback();
                    return;
                }

                exec('git describe --tags --always', (execError, stdout, stderr) => {
                    if (execError) {
                        console.error('Error executing Git command:', stderr);
                        compilation.errors.push(new Error('Failed to execute git describe --tags --always: ' + stderr));
                        callback();
                        return;
                    }

                    const version_info = `version: ${stdout.trim()}\ntime: ${new Date().toISOString()}\n`;
                    if (process.env.TRAVIS) {
                        version_info += `build id: TRAVIS ${process.env.TRAVIS_JOB_NUMBER} (${process.env.TRAVIS_BUILD_ID})\n`;
                    }

                    const filename = path.join(compiler.options.output.path, this.options.filename);

                    fs.writeFile(filename, version_info, (err) => {
                        if (err) {
                            compilation.errors.push(err);
                        }
                        callback();
                    });
                });
            });
        });
    }
}

function getWebpackConfig(production, gtag) {
    var webpackMode;

    production = (typeof(production) === 'undefined') ? false : production;
    gtag = (typeof(gtag) === 'undefined') ? "" : gtag;

    var plugins = [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                {from: 'assets/bootstrap.min.css', to: 'assets/'},
                {from: 'assets/images/favicon.ico', to: 'favicon.ico'},
                {from: 'assets/images/', to: 'assets/images/'},
            ]
        }),
        new DefinePlugin({
            GOOGLE_ANALYTICS_TAG: JSON.stringify(gtag)
        }),
        new HtmlWebpackPlugin({
            minify: {
                collapseWhitespace: true,
                conservativeCollapse: true,
                removeComments: true,
            },
            template: 'html/index.html',
        }),
        new VersionInfoPlugin({filename: 'version-info.txt'})
    ];

    if (production) {
        webpackMode = "production";
    } else {
        webpackMode = "development";
    }

    return {
        entry: "./src/ui.ts",
        output: {
            filename: "assets/bundle.[hash].js",
            path: path.join(__dirname, "dist")
        },
        plugins: plugins,
        optimization: {
            concatenateModules: false,
            minimizer: [
                new Terser({})
            ]
        },
        devtool: "source-map",
        devServer: {
            static: {
                directory: path.join(__dirname, 'public'),  // Adjust this path to your static files directory
            },
            port: process.env.PORT || 9000,  // You can specify the port here
            open: true,  // Automatically open the browser when the server starts
            hot: true    // Enable hot module replacement            port: 9000
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js']
        },
        mode: webpackMode,
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [{loader: 'ts-loader', options: {transpileOnly: false}}]
                },
                {
                    test: /\.m?js$/,
                    exclude: /node_modules/,
                    use: [{loader: 'babel-loader', options: {presets: ['@babel/preset-env']}}]
                }
            ]
        }
    }
}

exports.getWebpackConfig = getWebpackConfig