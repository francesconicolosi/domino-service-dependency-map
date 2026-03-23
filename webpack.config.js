const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        main: './js/main.js',
        second: './js/solitaire.js',
        third: './js/me.js'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/domino.html',
            filename: 'domino.html',
            inject: 'body',
            scriptLoading: 'blocking',
            chunks: ['main'],
            minify: {
                collapseWhitespace: true,
                keepClosingSlash: true,
                removeComments: true,
                removeRedundantAttributes: false, // do not remove type="text"
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true
            }
        }),
        new HtmlWebpackPlugin({
            template: './src/solitaire.html',
            filename: 'solitaire.html',
            inject: 'body',
            scriptLoading: 'blocking',
            chunks: ['second'],
            minify: {
                collapseWhitespace: true,
                keepClosingSlash: true,
                removeComments: true,
                removeRedundantAttributes: false, // do not remove type="text"
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true
            }
        }),
        new HtmlWebpackPlugin({
            template: './src/domino.html',
            filename: 'domino.html',
            inject: 'body',
            scriptLoading: 'blocking',
            chunks: ['third'],
            minify: {
                collapseWhitespace: true,
                keepClosingSlash: true,
                removeComments: true,
                removeRedundantAttributes: false, // do not remove type="text"
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true
            }
        }),
        new CopyWebpackPlugin({
            patterns: [
                {from: 'css', to: 'css'},
                {from: 'src/sample_services.csv', to: 'sample_services.csv'},
                {from: 'src/sample-people-database.csv', to: 'sample-people-database.csv'},
                {from: 'src/robots.txt', to: 'robots.txt'},
                {from: 'src/sitemap.xml', to: 'sitemap.xml'},
                { from: 'assets', to: 'assets' },
            ],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
};