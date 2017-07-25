const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");

module.exports = function (app, addon) {
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
};
