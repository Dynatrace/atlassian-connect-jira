const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");
const util = require("../util");

module.exports = function (app, addon, logger) {
    app.get("/issue-right", addon.authenticate(), function(req, res) {
      const httpClient = addon.httpClient(req);

      async.parallel([
          (cb) => util.getPid(req, httpClient, cb),
          (cb) => util.getTenant(req, httpClient, cb),
      ], (e, results) => {
        const pid = results[0];
        const tenant = results[1];
        const tenantUrl = tenant.tenant;
        const tenantToken = tenant.token;

        util.getProblemDetails(tenantUrl, tenantToken, pid, (err, dres, body) => {
          if (err) {
            console.error(err);
            res.render("error");
          }

          if (!body.result) {
            console.error(dres);
          }

          if (dres.statusCode !== 200) {
            res.render("error", { message: "There was an error communicating with Dynatrace" });
            return;
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

          problem.tagsOfAffectedEntities = (problem.tagsOfAffectedEntities || []).map(t => {
            t.link = `${req.query["xdm_e"]}/browse/${req.query.issue}?jql=dynatraceTags%20~%20%22${t.key}%22`;
            return t;
          });
          problem.manyTags = [problem.tagsOfAffectedEntities.length] > 10;
          problem.topTags = problem.tagsOfAffectedEntities.slice(0, 10);
          res.render("issue", { problem, tenant: tenant.tenant, issue: req.query.issue });
        });
      });
    });
};
