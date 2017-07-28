"use strict";

const request = require("request");
const async = require("async");
const key = require("./atlassian-connect").key;
const url = require("url");
const escape = require("escape-html");

// Returns the full link to the JIRA Ticket that is referenced in the request object
function getJiraTicketLink(req, ticketId) {
  var issueId = req.query.issue;
  var baseJiraURL = null;
  if (req.headers["xdm_e"]) {
    baseJiraURL = req.headers["xdm_e"];
  } else {
    // lets see if we have a comment.self
    if (req.body.comment && req.body.comment.self) {
      baseJiraURL = req.body.comment.self;
    }
  }
  if (baseJiraURL == null) baseJiraURL = "http://yourjiraserver.com/browse/";
  var parsedUrl = url.parse(baseJiraURL);
  return `${parsedUrl.protocol}//${parsedUrl.host}/browse/${ticketId}`;
}

function getTenant(req, httpClient, cb) {
  httpClient.get({
    uri: `/rest/atlassian-connect/1/addons/${key}/properties/tenant`,
    json: true,
  }, (err, ires, body) => {
    if (err) { return cb(err); }
    req.tenant = body.value;
    cb(null, req.tenant);
  });
}

function getPid(req, httpClient, cb) {
  if (!req.dynatraceProblem)
    req.dynatraceProblem = {};
  if (req.query.issue) {
    httpClient.get({
      uri: `/rest/api/2/issue/${req.query.issue}/properties/dynatraceProblemId`,
      json: true,
    }, (err, ires, body) => {
      if (err) { return cb(err); }

      // BACKWARD COMP CHECK. In the first version of Dynatrace -> JIRA Integration we only had the string value as PID. Now we need to wrap it into a JSON Object
      if (!body.value) {
        // no property set!
      } else
        if (typeof body.value === 'string') {
          req.pid = body.value;
          req.dynatraceProblem = { pid: req.pid }
          setDynatraceProblem(httpClient, req, req.dynatraceProblem, null);
        } else {
          req.dynatraceProblem = body.value;
          // always provide req.pid with the problem id
          req.pid = req.dynatraceProblem.pid;
        }

      cb(null, req.pid);
    });
  } else {
    cb();
  }
}

/**
 * This function assumes a valid dynatraceProblem object with a valid .pid value. It queries current problem status from Dynatrace
 * @param {*} tenantUrl 
 * @param {*} tenantToken 
 * @param {*} dynatraceProblem 
 * @param {will return the updated dynatraceProblem object} cb 
 */
function refreshDynatraceProblem(tenantUrl, tenantToken, dynatraceProblem, cb) {
  if (dynatraceProblem && dynatraceProblem.pid) {
    getProblemDetails(tenantUrl, tenantToken, dynatraceProblem.pid, (err, dres, body) => {
      if (err) {
        console.error(err);
        cb(err, null);
        return;
      }

      if (!body.result) {
        console.error(dres);
        cb(new Error("No Result from Dynatrace"), null);
        return;
      }

      if (dres.statusCode !== 200) {
        cb(new Error("Error Result from Dynatrace"), null);
        return;
      }

      // pull all key Dynatrace Problem info and put it into JIRA Dynatrace Property Object
      const problem = body.result;
      if (problem.tagsOfAffectedEntities) {
        dynatraceProblem.tags = problem.tagsOfAffectedEntities.map((tag) => tag.key).join(" ");
      }
      dynatraceProblem.problem = problem.displayName;
      dynatraceProblem.impact = problem.impactLevel;
      dynatraceProblem.severity = problem.severityLevel;
      dynatraceProblem.hasRootCause = problem.rankedEvents[0].isRootCause.toString();
      dynatraceProblem.status = problem.status;

      cb(null, dynatraceProblem);
    });
  }
  return;
}


function setDynatraceProblem(httpClient, req, dynatraceProblem, cb) {
  httpClient.put({
    uri: `/rest/api/2/issue/${req.query.issue}/properties/dynatraceProblemId`,
    body: dynatraceProblem,
    json: true
  }, (err, ires, body) => {
    // req.pidRequiresUpdate means we are up to date
    req.pidRequiresUpdate = false;
    console.log("Response from setting dynatraceProblemId property to parsed Problem Id: " + dynatraceProblem.pid);
    console.log(body);
    if (cb) cb(err, ires, body);
  });
}

function getProblemDetails(tenant, token, pid, cb) {
  request.get({
    uri: `${tenant}/api/v1/problem/details/${pid}`,
    headers: {
      Authorization: `Api-Token ${token}`,
    },
    json: true,
  }, cb);
}

/**
 * Adds a comment to the Dynatrace Problem
 * @param {string} tenant Dynatrace Tenant URL
 * @param {string} token Dynatrace API Token
 * @param {string} pid 
 * @param {string} comment 
 * @param {string} user 
 * @param {string} context 
 * @param {string} jiraTicketLink 
 * @param {function} cb 
 */
function addProblemComment(tenant, token, pid, comment, user, context, jiraTicketLink, cb) {
  // Lets build the comment string to first contain a link back to the JIRA Ticket
  comment = `Comment sync on [JIRA - ${context}](${jiraTicketLink})\n----------------------------------------\n${comment}`;
  var dtComment = {
    comment,
    user,
    context
  }
  var postUrl = `${tenant}/api/v1/problem/details/${pid}/comments`
  console.log("Dynatrace POST Url: " + postUrl)
  request.post({
    uri: postUrl,
    headers: {
      Authorization: `Api-Token ${token}`,
    },
    body: dtComment,
    json: true,
  }, cb);
}

function getProblemComments(tenant, token, pid, cb) {
  request.get({
    uri: `${tenant}/api/v1/problem/details/${pid}/comments`,
    headers: {
      Authorization: `Api-Token ${token}`,
    },
    json: true,
  }, cb);
}

function getProblemDetailsWithComments(tenant, token, pid, cb) {
  async.parallel([
    acb => getProblemDetails(tenant, token, pid, acb),
    acb => getProblemComments(tenant, token, pid, acb),
  ], (e, results) => {
    if (e) { return cb(e); }

    if (!results[0][1] || !results[1][1]) {
      return cb();
    }

    if (results[0][0].statusCode !== 200) {
      console.log("Could not find problem");
      return cb();
    }

    const problem = results[0][1].result;

    if (results[1][0].statusCode !== 200) {
      console.log("Could not find comments");
      problem.comments = [];
      return cb(null, problem);
    }

    const comments = results[1][1].comments.map(c => {
      c.isComment = true;
      c.startTime = c.createdAtTimestamp;
      c.content = escape(c.content);
      c.content = c.content.replace(/(?:\r\n|\r|\n)/g, '<br />');
      return c;
    });;
    problem.comments = comments;
    cb(null, problem);
  });
}

const modifiers = {
  SYNTHETIC: "#monitors/webcheckdetail;webcheckId",
  HOST: "#hostdetails;id",
  APPLICATION: "#uemappmetrics;uemapplicationId",
  MOBILE_APPLICATION: "#mobileappoverview;appId",
  SERVICE: "#services/servicedetails;id",
  PROCESS: "#processdetails;id",
  PROCESS_GROUP_INSTANCE: "#processdetails;id",
  PROCESS_GROUP: "#processgroupdetails;id",
  HYPERVISOR: "#hypervisordetails;id",
  SYNTHETIC_TEST: "#webcheckdetailV3;webcheckId",
  DCRUM_APPLICATION: "#entity;id",
};

function eventLink(tenant, event, pid) {
  const entityType = event.entityId.split("-")[0];
  const modifier = modifiers[entityType];

  if (!modifier) {
    console.log(entityType);
    return `${tenant}/#problems/problemdetails;pid=${pid}`;
  }

  return `${tenant}/${modifier}=${event.entityId};gtf=p_${pid};pid=${pid}`;
}

module.exports = {
  eventLink,
  getTenant,
  getPid,
  refreshDynatraceProblem,
  getProblemDetails,
  addProblemComment,
  getJiraTicketLink,
  getProblemDetailsWithComments,
  setDynatraceProblem,
};