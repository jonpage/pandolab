/**
 * The script file needs to implement a beginPeriod function and a beginStage function.
 * The table object will be passed to the stage templates, so that's where to put anything
 * which needs to be displayed to the user.
 */

/**
 * This function is called once at the beginning of each period
 */
exports.beginPeriod = function(table){
    // set endowment
    table.globals.endowment = 100;
    table.globals.proposers = [];

    // set types
    for (var i = 0; i < table.subjects.length; i++) {
        // see if a proposer has already been defined for the current group
        if (typeof table.globals.proposers[table.subjects[i].group] === 'undefined') {
            console.log("subject " + i + " should be the proposer");
            table.globals.proposers[table.subjects[i].group] = i;
            table.subjects[i].type = 'proposer';
            console.log("type = " + table.subjects[i].type);

        } else {
            console.log("subject " + i + " should be the responder");
            table.subjects[i].type = 'responder';
            console.log("type = " + table.subjects[i].type);
        }
    }
    console.log(JSON.stringify(table.globals.proposers));
}

// This function is called once at the beginning of each stage, stageName is a string
exports.beginStage = function(table,stageName, subjectNum){
    var groupOffer = [];
    console.log("Stage: " + stageName);
    for (var i = 0; i < table.subjects.length; i++) {
        switch (stageName) {
            case 'Propose':
                console.log("Propose stage");
                table.subjects[i].participate = table.subjects[i].type == 'proposer' ? true : false;
                console.log("Subject " + i + " particpate = " + table.subjects[i].participate);
                break;
            case 'Respond':
                console.log("Respond stage");
                table.subjects[i].participate = table.subjects[i].type == 'responder' ? true : false;
                if (table.subjects[i].type == 'proposer') {
                    table.subjects[i].share = table.globals.endowment - table.subjects[i].offer;
                } else {
                    // find relevant offer
                    for (var j = 0; j < table.subjects.length; j++) {
                        if (table.subjects[j].group == table.subjects[i].group && table.subjects[j].type == 'proposer') {
                            table.subjects[i].share = table.subjects[j].offer;
                        }
                    }
                }
                break;
            case 'Profit Display':
                console.log('Profit Display stage');
                table.subjects[i].participate = true;
                if (table.subjects[i].type == 'proposer') {
                    // see if offer was accepted
                    for (var j = 0; j < table.subjects.length; j++) {
                        if (table.subjects[j].group === table.subjects[i].group && i !== j) {
                            if (table.subjects[j].accept === true) {
                                table.subjects[i].profit = table.subjects[i].share;
                                table.subjects[j].profit = table.subjects[j].share;
                            } else {
                                table.subjects[i].profit = 0;
                                table.subjects[j].profit = 0;
                            }
                        }
                    }
                }
            default:
                console.log('default stage');
                table.subjects[i].participate = true;
                break;
        }
    }
}

// this is the function to handle data updates (e.g., for chat or contract table)
exports.updateData = function(table, stageName, subjectNum, command, data) {
   console.log("inside user function for update table"); 
}

// all helper functions should be requirable by a simple ztree = require("ztree") statement
// consider passing objects to ztree variables so that arguments can be labelled, might be too difficult for users.

/**
 * Takes an array and two strings to identify the summand and the grouping parameter
 * TODO support parseInt and parseFloat
 */
var sumBy = function(table, variable, group) {
    var sum = {};
    var groupIndex;
    for (var i = 0; i < table.length; i++) {
        groupIndex = table[i][group];
        if( typeof sum[groupIndex] !== 'undefined' ) {
            sum[groupIndex] = sum[groupIndex] + +table[i][variable];
        } else {
            sum[groupIndex] = +table[i][variable];
        }
    }
    return sum;
}

var countBy = function(table, variable, group) {
    var count = {};
    var groupIndex;
    for (var i = 0; i < table.length; i++) {
        groupIndex = table[i][group];
        if( typeof count[groupIndex] !== 'undefined' ) {
            count[groupIndex] = +count[groupIndex] + 1;
        } else {
            count[groupIndex] = 1;
        }
    }
    return count;
}

var minBy = function(table, variable, group) {
    var min = {};
    for (var i = 0; i < table.length; i++) {
        groupIndex = table[i][group];
        if (typeof min[groupIndex] !== 'undefined') {
            min[groupIndex] = Math.min(table[i][variable], min[groupIndex]);
        } else {
            min[groupIndex] = +table[i][variable];
        }
    }
    return min;
}

var maxBy = function(table, variable, group) {
    var max = {};
    for (var i = 0; i < table.length; i++) {
        groupIndex = table[i][group];
        if (typeof max[groupIndex] !== 'undefined') {
            max[groupIndex] = Math.max(+table[i][variable], max[groupIndex]);
        } else {
            max[groupIndex] = +table[i][variable];
        }
    }
    return min;
}

var avgBy = function(table, variable, group) {
    var avg = {};
    sum = sumBy(table, variable, group);
    count = countBy(table, variable, group);
    for (var groupIndex in sum) {
        if (sum.hasOwnProperty(groupIndex) && count.hasOwnProperty(groupIndex)) {
            avg[groupIndex] = sum[groupIndex] / count[groupIndex];
        }
    }
    return avg;
}

