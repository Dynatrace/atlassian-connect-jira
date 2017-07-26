const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");
const util = require("../util");

module.exports = function (app, addon) {
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
          // console.log(JSON.stringify(problem, null, 2));
          res.render("issue", { problem, tenant: tenant.tenant });
        });
      });
    });
};
