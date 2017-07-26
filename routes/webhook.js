const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");
const util = require("../util");

module.exports = function (app, addon) {
    app.post("/comment-created", addon.authenticate(), (req, res) => {
      var httpClient = addon.httpClient(req);

      async.parallel([
        (cb) => util.getPid(req, httpClient, cb),
        (cb) => util.getTenant(req, httpClient, cb),
      ], (e, results) => {
        if(e) {
          res.status(500).json(e);
          console.log("e");
          return;
        }
        pid = results[0];                  // Current Problem Id on the JIRA Ticket
        const tenant = results[1];         // Dynatrace Tenant
        const tenantUrl = tenant.tenant;   // Dynatrace TenantURL
        const tenantToken = tenant.token;  // Dynatrace TenantToken

        // we will parse the new comment and look for the Dynatrace URL. In case a comment includes a link to a problem we will
        // #1: Update the dynatraceProblemId on the JIRA Ticket -> that enables our JIRA Integration
        // #2: We will also put a comment on Dynatrace to link it to the JIRA Ticket

        // Step 1: Parse the Comment and look for Dynatrace URL
        if(req.body.webhookEvent == "comment_created") {
          var timestamp = req.body.comment.created;
          var author = req.body.comment.author.name;
          var comment = req.body.comment.body;

          if(comment.includes("/#problems/problemdetails")) {
            // parse the Problem Id. Here is a sample URL: https://jnc47888.live.dynatrace.com/#problems/problemdetails;pid=-2490005493678692038 
            var parsedPid = comment.match(/\/problemdetails.+pid=(-?\d+)/);
            if(parsedPid) {
              parsedPid = parsedPid[1];
            } else {
              // no valid Dynatrace URL with Problem ID -> stop
              res.status(500).send("Couldnt parse Dynatrace Problem Id from comment!");
              return;
            }

            // Step 2: Add dynatraceProblemId to the JIRA Ticket in case its not there yet
            // its the first time somebody posts a PID on this Ticket -> so we link the JIRA Ticket with Dynatrace
            if(!pid) {
              pid = parsedPid;
              httpClient.put({
                uri: `/rest/api/2/issue/${req.query.issue}/properties/dynatraceProblemId`,
                body: `"${parsedPid}"`
              }, (err, ires, body) => {
                console.log("Response from setting dynatraceProblemId property to parsed Problem Id: " + parsedPid);
                console.log(body);
              });
            } else {
              // TODO: in the future we could think about storing links to more than one Dynatrace Problem
            }              
          }

          // Step 3: Add a comment on the Dynatrace Problem ID and link to the JIRA Ticket
          if(pid) {
            util.addProblemComment(tenantUrl, tenantToken, pid, comment, author, req.query.issue, util.getJiraTicketLink(req, req.query.issue), (err, ires, body) => {
              console.log("Response from Updating Dynatrace Problem: " + pid);
              console.log(body);
            });
          }

          // Step 4: if somebody posted a link to a problem which is not the same we are already linked to - just add a comment to that new Problem Id
          if(parsedPid && (pid != parsedPid)) {
            util.addProblemComment(tenantUrl, tenantToken, parsedPid, comment, author, req.query.issue, util.getJiraTicketLink(req, req.query.issue), (err, ires, body) => {
              console.log("Response from Updating Dynatrace Problem: " + parsedPid);
              console.log(body);
            });
          }
        }
      })

      res.status(200).send();
    });
};
