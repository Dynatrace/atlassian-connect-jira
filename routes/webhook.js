const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");

module.exports = function (app, addon) {
    app.get("/issue-updated", addon.authenticate(), (req, res) => {
      var httpClient = addon.httpClient(req);

      async.parallel([
        (cb) => util.getPid(req, httpClient, cb),
        (cb) => util.getTenant(req, httpClient, cb),
      ], (e, results) => {
        const pid = results[0];
        const tenant = results[1];
        const tenantUrl = tenant.tenant;
        const tenantToken = tenant.token;

        // we will parse the new comment and look for the Dynatrace URL. In case a comment includes a link to a problem we will
        // #1: Update the dynatraceProblemId on the JIRA Ticket -> that enables our JIRA Integration
        // #2: We will also put a comment on Dynatrace to link it to the JIRA Ticket

        // Step 1: Parse the Comment and look for Dynatrace URL
        if(req.event == "jira:issue_updated") {
          // var ts = req.timestamp;
          // var comment = req.comment;

          // if(comment.includes(req.dynatraceTenant)) {

          //}
        }

        // Step 2: Update dynatraceProblemId on the JIRA Ticket in case not present
        // TODO: if dynatraceProblemId is already there we could do a sanity check if this problem is still valid and available in Dynatrace

        // Step 3: Add a comment on the Dynatrace Problem ID and link to the JIRA Ticket

      })
    });
};
