const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");

module.exports = function (app, addon) {
    app.get("/event-feed", addon.authenticate(), (req, res) => {
      var httpClient = addon.httpClient(req);
    });
};