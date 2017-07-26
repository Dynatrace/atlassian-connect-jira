const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");
const util = require("../util");
const moment = require("moment-timezone");

module.exports = function (app, addon) {
    app.get("/event-feed", addon.authenticate(), (req, res) => {
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

          const events = _.sortBy(problem.rankedEvents, e => -e.startTime).map(impact => {
            impact.closed = impact.status === "CLOSED";
            impact.eventName = language.eventType[impact.eventType];
            impact.renderedTime = moment.tz(impact.startTime, req.query.tz).calendar();
            if (impact.closed) {
              impact.renderedEndTime = moment.tz(impact.endTime, req.query.tz).calendar();
            }
            impact.link = util.eventLink(tenantUrl, impact, pid);
            return impact;
          });

          res.render("event-feed", { events });
        });
      });
    });
};
