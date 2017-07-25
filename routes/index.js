const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");

module.exports = function (app, addon) {

    // Root route. This route will serve the `atlassian-connect.json` unless the
    // documentation url inside `atlassian-connect.json` is set
    app.get('/', function (req, res) {
        res.format({
            // If the request content-type is text-html, it will decide which to serve up
            'text/html': function () {
                res.redirect('/atlassian-connect.json');
            },
            // This logic is here to make sure that the `atlassian-connect.json` is always
            // served up when requested by the host
            'application/json': function () {
                res.redirect('/atlassian-connect.json');
            }
        });
    });

    // This is an example route that's used by the default "generalPage" module.
    // Verify that the incoming request is authenticated with Atlassian Connect
    app.get('/hello-world', addon.authenticate(), function (req, res) {
            // Rendering a template is easy; the `render()` method takes two params: name of template
            // and a json object to pass the context in
            res.render('hello-world', {
                title: 'Atlassian Connect'
                //issueId: req.query['issueId']
            });
        }
    );

    app.get("/jira-issue-right", addon.authenticate(), (req, res) => {
      var httpClient = addon.httpClient(req);
    });

    app.get("/issue-right", addon.authenticate(), function(req, res) {
      var endpoint = `/rest/api/latest/issue/${req.query.issue}`;
      var httpClient = addon.httpClient(req);

      async.parallel([
          (cb) => {
            httpClient.get({
              uri: `/rest/api/2/issue/${req.query.issue}/properties/dynatraceProblemId`,
            }, (err, ires, body) => {
              if (err) {
                cb(err);
              } else {
                cb(null, JSON.parse(body).value);
              }
            });
          },
          (cb) => {
            httpClient.get({
              uri: "/rest/atlassian-connect/1/addons/dynatrace-jira-2way/properties/tenant",
            }, (err, ires, body) => {
              if (err) {
                cb(err);
              } else {
                cb(null, JSON.parse(body).value);
              }
            });
          }
      ], (e, results) => {
        const pid = results[0];
        const tenant = results[1];
        const tenantUrl = tenant.tenant;
        const tenantToken = tenant.token;

        request.get({
          uri: `${tenantUrl}/api/v1/problem/details/${pid}`,
          headers: {
            Authorization: `Api-Token ${tenantToken}`,
          },
          json: true,
        }, (err, dres, body) => {
          if (err) {
            console.log(err);
            res.render("error");
          }

          const problem = body.result;
          problem.hasRootCause = problem.rankedEvents.filter(e => e.isRootCause).length > 0;
          const last = problem.rankedEvents[problem.rankedEvents.length - 1];
          const eventName = language.eventType[last.eventType] || last.eventType;

          problem.title = `${eventName} on ${last.entityName}`;
          problem.closed = problem.status === "CLOSED";
          problem.severityLevelName = language.severityLevel[problem.severityLevel] || problem.severityLevel;
          problem.impactLevelName = language.impactLevel[problem.impactLevel] || problem.impactLevel;
          problem.numEntitiesAffected = _.uniq(problem.rankedEvents.map(e => e.entityId)).length;

          problem.tagsOfAffectedEntities = problem.tagsOfAffectedEntities || [];
          problem.manyTags = [problem.tagsOfAffectedEntities.length] > 10;
          problem.topTags = problem.tagsOfAffectedEntities.slice(0, 10);
          console.log(JSON.stringify(problem, null, 2));
          res.render("issue", { problem, tenant: tenant.tenant });
        });
      });
    });

    app.get("/config", addon.authenticate(), function(req, res) {
      var httpClient = addon.httpClient(req);
      httpClient.get({
        uri: "/rest/atlassian-connect/1/addons/dynatrace-jira-2way/properties/tenant",
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
        uri: "/rest/atlassian-connect/1/addons/dynatrace-jira-2way/properties/tenant",
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

      httpClient.del("/rest/atlassian-connect/1/addons/dynatrace-jira-2way/properties/tenant", (err, ires, body) => {
        res.render('config', {
          title: "Dynatrace JIRA (Deleted)",
          tenant: "",
          dtoken: ""
        });
      });
    });

    // Add any additional route handlers you need for views or REST resources here...


    // load any additional files you have in routes and apply those to the app
    {
        var fs = require('fs');
        var path = require('path');
        var files = fs.readdirSync("routes");
        for(var index in files) {
            var file = files[index];
            if (file === "index.js") continue;
            // skip non-javascript files
            if (path.extname(file) != ".js") continue;

            var routes = require("./" + path.basename(file));

            if (typeof routes === "function") {
                routes(app, addon);
            }
        }
    }
};
