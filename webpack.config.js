const path = require("path");

module.exports = {
  mode: "production",
  entry: ["./js/main.js"],
  output: {
    path: path.resolve(__dirname),
    filename: "bundle.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: { 
              presets: [[
                  "babel-preset-env", {
                      targets: {
                          browsers: ["last 2 Chrome versions", "last 2 Firefox versions"],
                      },
                  }
              ]]
          }
        }
      },
    ]
  }, 
};

