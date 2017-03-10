const request = require('request');
const xmlToJSon = require('xml2js');
const elasticsearch = require('elasticsearch');
const uuidV4 = require('uuid/v4');
const uniStudioWaitURL = 'http://www.universalstudioshollywood.com/waittimes/?type=all&site=USH';
const interval = 900000; // in millisecond 1000 * 60 * 15 = 15 min.
const indexName = 'cs499-unistu';

const client = new elasticsearch.Client({
    host: 'https://search-cs499-test-u7rful5wfi3xx3gmneoeuer3qm.us-west-2.es.amazonaws.com/',
    log: 'info'
});

/**
 * Call this to get the connection status to AWS Elasticsearch
 */
var checkStatus = function () {
    client.ping({
        // ping usually has a 3000ms timeout
        requestTimeout: 5000
    }, function (error) {
        if (error) {
            console.trace('elasticsearch cluster is down!');
        } else {
            console.log('All is well');
        }
    });
};

/**
 * Read HTML from the URL as string
 * @param url
 */
var getXmlWaitTime = function (url) {
    request(url, function (error, response, body) {
        if (error) {
            console.error(error);
            console.log("getting XML Error");
        } else {
            getJSON(body);
        }
    });
};

/**
 * Convert XML to JSON
 * Pass necessary data
 * @param xml
 */
var getJSON = function (xml) {
    xmlToJSon.parseString(xml, function (error, json) {
        if (error) {
            console.error("XML to JSON error: " + error);
            console.log('error');
        } else {
            getWaitTimes(json.rss.channel[0].item);
        }
    });
};

/**
 * Choose correct wait time.
 * Choosing items with short wait time only (## Min)
 * @param json
 */
var getWaitTimes = function (json) {
    var validRecordShortWait = /(\d+) min/;
    var allTimes = [];
    var dateNow = Date.now();
    for (var i = 0; i < json.length; i++) {
        var eachWaitTime = JSON.stringify(json[i].description[0]);
        if (eachWaitTime.match(validRecordShortWait)) {
            allTimes.push({
                'title': json[i].title[0],
                'wait_time': eachWaitTime.replace(' min', '').replace('"', '').trim(),
                'timestamp': dateNow
            });
        }
    }
    sendToElastic(allTimes)
};

/**
 * Send one by one to ElasticSearch
 * @param data
 */
var sendToElastic = function (data) {
    for (var i = 0; i < data.length; i++) {
        client.create({
            index: indexName,
            type: 'WaitTime',
            id: uuidV4(),
            body: data[i]
        }, function (error, response) {
            if (error) {
                console.error("Elastic Add Error: " + error);
            } else {
                console.log(response);
            }
        });
    }
};

/**
 * Run it every timeout second
 */
var timeout = function () {
    setInterval(function () {
        getXmlWaitTime(uniStudioWaitURL);
    }, interval)
};

timeout();

/**
 * NOTE:
 * Deleting index from AWS-ElasticSearch
 * curl -XDELETE 'https://<end-point>/<index-name>'
 * example:
 * curl -XDELETE 'https://search-cs499-test-u7rful5wfi3xx3gmneoeuer3qm.u.com/cs499-unistu'
 */
