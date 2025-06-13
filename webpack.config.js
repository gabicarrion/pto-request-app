const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  target: 'web', // Ensure we're targeting web environment
  entry: './src/static/index.jsx',
  output: {
    path: path.resolve(__dirname, 'static'),
    filename: '[name].[contenthash].js',
    clean: true,
    globalObject: 'this' // Prevent window/global issues
  },
  mode: process.env.NODE_ENV || 'production',
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: false,
        },
      },
    })],
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['last 2 versions']
                }
              }], 
              ['@babel/preset-react', {
                runtime: 'classic'
              }]
            ],
            plugins: ['@babel/plugin-syntax-dynamic-import']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }),
    new HtmlWebpackPlugin({
      template: './src/static/index.html',
      filename: 'index.html',
      inject: 'body',
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      "crypto": false,
      "buffer": false,
      "stream": false,
      "path": false,
      "fs": false
    }
  },
  node: {
    global: false,
    __filename: false,
    __dirname: false,
  }
};