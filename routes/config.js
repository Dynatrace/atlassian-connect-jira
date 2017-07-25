const request = require("request");
const key = require("../atlassian-connect").key;
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");

module.exports = function (app, addon) {
    app.get("/config", addon.authenticate(), function(req, res) {
      var httpClient = addon.httpClient(req);
      httpClient.get({
        uri: `/rest/atlassian-connect/1/addons/${key}/properties/tenant`,
      }, (err, ires, body) => {
        console.log(body);
        const config = JSON.parse(body);
        console.log(config);
        res.render('config', {
          title: "Dynatrace JIRA",
          tenant: ((config || {}).value || {}).tenant || "",
          dtoken: ((config || {}).value || {}).token || "",
        });
      });

    });

    app.get("/save-config", addon.checkValidToken(), function(req, res) {
      var httpClient = addon.httpClient(req);
      const tenant = req.query["tenant-url"]
      const tenantToken = req.query["tenant-token"]

      httpClient.put({
        uri: `/rest/atlassian-connect/1/addons/${key}/properties/tenant`,
        body: JSON.stringify({
          tenant: req.query["tenant-url"],
          token: req.query["tenant-token"],
        }),
      }, (err, ires, body) => {
        res.render('config', {
          title: "Dynatrace JIRA (Saved)",
          tenant: req.query["tenant-url"],
          dtoken: req.query["tenant-token"],
        });
      });
    });

    app.get("/delete-config", addon.checkValidToken(), (req, res) => {
      var httpClient = addon.httpClient(req);

      httpClient.del(`/rest/atlassian-connect/1/addons/${key}/properties/tenant`, (err, ires, body) => {
        res.render('config', {
          title: "Dynatrace JIRA (Deleted)",
          tenant: "",
          dtoken: ""
        });
      });
    });
};
