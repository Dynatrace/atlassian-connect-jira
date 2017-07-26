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
        const pid = results[0];
        const tenant = results[1];
        const tenantUrl = tenant.tenant;
        const tenantToken = tenant.token;

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
            var foundPid = comment.match(".*/problemdetails;pid=(.*)");
            if(foundPid != null) {
              // TODO - make sure this is a proper Pid and no other characters are following - right now we just trim in case we find a trailing whitespace
              foundPid = foundPid[1];
              var firstWhite = foundPid.indexOf(" ");
              if(firstWhite > 0) foundPid = foundPid.substr(0, firstWhite + 1);
            }

            foundPid = parseInt(foundPid);

            // Step 2: Add dynatraceProblemId to the JIRA Ticket in case its not there yet
            if(foundPid != 0) {
              // its the first time somebody posts a PID on this Ticket -> so we link the JIRA Ticket with Dynatrace
              if(pid == "") {
                httpClient.put({
                  uri: `/rest/api/2/issue/${req.query.issue}/properties/dynatraceProblemId`,
                  json: `"${foundPid}"`
                }, (err, ires, body) => {
                  console.log(body);
                });
              } else {
                // TODO: in the future we could think about storing links to more than one Dynatrace Problem
              }
            }
          }

          // Step 3: Add a comment on the Dynatrace Problem ID and link to the JIRA Ticket
          util.addProblemComment(tenantUrl, tenantToken, pid, comment, author, req.query.issue, (err, ires, body) => {
            console.log(body);
          });
        }
      })
    });
};
