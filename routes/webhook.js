const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");
const util = require("../util");


function linkWithDynatraceProblem(httpClient, req, tenantUrl, tenantToken, dynatraceProblem, timestamp, author, updatedJiraCommentDesc, commentToPushToDynatrace) {
  var comment = updatedJiraCommentDesc;

  if (comment.includes("/#problems/problemdetails")) {
    // parse the Problem Id. Here is a sample URL: https://jnc47888.live.dynatrace.com/#problems/problemdetails;pid=-2490005493678692038 
    var parsedPid = comment.match(/\/problemdetails.+pid=(-?\d+)/);
    if (parsedPid) {
      parsedPid = parsedPid[1];
    } else {
      // no valid Dynatrace URL with Problem ID -> stop
      res.status(500).send("Couldnt parse Dynatrace Problem Id from comment!");
      return;
    }

    // Step 2: Add dynatraceProblemId to the JIRA Ticket in case its not there yet
    // its the first time somebody posts a PID on this Ticket -> so we link the JIRA Ticket with Dynatrace
    if (!dynatraceProblem.pid) {
      dynatraceProblem.pid = parsedPid;

      // pull latest data from Dynatrace and if successfull push it to JIRA!
      util.refreshDynatraceProblem(tenantUrl, tenantToken, dynatraceProblem, (err, result) => {
        util.setDynatraceProblem(httpClient, req, result);
      });
    } else {
      // TODO: in the future we could think about storing links to more than one Dynatrace Problem
    }
  }

  if (!dynatraceProblem) return;

  // Step 3: Add a comment on the Dynatrace Problem ID and link to the JIRA Ticket
  if (dynatraceProblem.pid) {
    util.addProblemComment(tenantUrl, tenantToken, dynatraceProblem.pid, commentToPushToDynatrace, author, req.query.issue, util.getJiraTicketLink(req, req.query.issue), (err, ires, body) => {
      console.log("Response from Updating Dynatrace Problem: " + dynatraceProblem.pid);
      console.log(body);
    });
  }

  // Step 4: if somebody posted a link to a problem which is not the same we are already linked to - just add a comment to that new Problem Id
  if (parsedPid && (dynatraceProblem.pid != parsedPid)) {
    util.addProblemComment(tenantUrl, tenantToken, parsedPid, commentToPushToDynatrace, author, req.query.issue, util.getJiraTicketLink(req, req.query.issue), (err, ires, body) => {
      console.log("Response from Updating Dynatrace Problem: " + parsedPid);
      console.log(body);
    });
  }
}


module.exports = function (app, addon) {
  app.post("/issue-created", addon.authenticate(), (req, res) => {
    var body = req.body;
    var httpClient = addon.httpClient(req);

    async.parallel([
      (cb) => util.getPid(req, httpClient, cb),
      (cb) => util.getTenant(req, httpClient, cb),
    ], (e, results) => {
      if (e) {
        res.status(500).json(e); console.log("e"); return;
      }
      dynatraceProblem = req.dynatraceProblem; // Full Dynatrace Problem JSON Object from the ticket
      const tenant = results[1];           // Dynatrace Tenant
      const tenantUrl = tenant.tenant;        // Dynatrace TenantURL
      const tenantToken = tenant.token;         // Dynatrace TenantToken

      // Step 1: Link with Dynatrace if the description contains a link to a Dynatrace Problem
      var timestamp = req.body.timestamp;
      var author = req.body.user.name;
      var changedDescription = req.body.issue.fields.description;

      if (changedDescription) {
        var pushCommentToDynatrace = "Dynatrace problem was referenced in JIRA Description";
        linkWithDynatraceProblem(httpClient, req, tenantUrl, tenantToken, dynatraceProblem, timestamp, author, changedDescription, pushCommentToDynatrace);
      }
    })
  });

  app.post("/issue-updated", addon.authenticate(), (req, res) => {
    if (req.body.webhookEvent != "jira:issue_updated")
      return;

    // First lets check if description or status was actually changed
    var changedDescription = null;
    var jiraTicketStatusChange = false;
    if (req.body.changelog) {
      for (i = 0; i < req.body.changelog.items.length; i++) {
        if (req.body.changelog.items[i].field == "description") {
          changedDescription = req.body.changelog.items[i].toString;
        }
        if (req.body.changelog.items[i].field == "status") {
          jiraTicketStatusChange = true;
        }
      }
    }

    // if we have a change then lets do the updates!
    if (changedDescription || jiraTicketStatusChange) {
      var body = req.body;
      var httpClient = addon.httpClient(req);

      async.parallel([
        (cb) => util.getPid(req, httpClient, cb),
        (cb) => util.getTenant(req, httpClient, cb),
      ], (e, results) => {
        if (e) {
          res.status(500).json(e); console.log("e"); return;
        }
        dynatraceProblem = req.dynatraceProblem; // Full Dynatrace Problem JSON Object from the ticket
        const tenant = results[1];           // Dynatrace Tenant
        const tenantUrl = tenant.tenant;        // Dynatrace TenantURL
        const tenantToken = tenant.token;         // Dynatrace TenantToken

        // Step 1: Link with Dynatrace if the description contains a link to a Dynatrace Problem
        var timestamp = req.body.timestamp;
        var author = req.body.user.name;
        if (changedDescription) {
          var pushCommentToDynatrace = "Dynatrace problem was referenced in JIRA Description";
          linkWithDynatraceProblem(httpClient, req, tenantUrl, tenantToken, dynatraceProblem, timestamp, author, changedDescription, pushCommentToDynatrace);
        } else if (jiraTicketStatusChange && dynatraceProblem.pid) {
          // pull latest data from Dynatrace and if successfull push it to JIRA!
          util.refreshDynatraceProblem(tenantUrl, tenantToken, dynatraceProblem, (err, result) => {
            dynatraceProblem = result;
            util.setDynatraceProblem(httpClient, req, dynatraceProblem);
          });
        }
      })

    }
    res.status(200).send();
  });

  app.post("/comment-created", addon.authenticate(), (req, res) => {
    var httpClient = addon.httpClient(req);

    async.parallel([
      (cb) => util.getPid(req, httpClient, cb),
      (cb) => util.getTenant(req, httpClient, cb),
    ], (e, results) => {
      if (e) {
        res.status(500).json(e); console.log("e"); return;
      }
      dynatraceProblem = req.dynatraceProblem; // Full Dynatrace Problem JSON Object from the ticket
      // pid               = dynatraceProblem.pid; // Current Problem Id on the JIRA Ticket
      const tenant = results[1];           // Dynatrace Tenant
      const tenantUrl = tenant.tenant;        // Dynatrace TenantURL
      const tenantToken = tenant.token;         // Dynatrace TenantToken

      // Step 1: Parse the Comment and look for Dynatrace URL
      var timestamp = req.body.comment.created;
      var author = req.body.comment.author.name;
      var comment = req.body.comment.body;

      linkWithDynatraceProblem(httpClient, req, tenantUrl, tenantToken, dynatraceProblem, timestamp, author, comment, comment);
    })

    res.status(200).send();
  });
};
