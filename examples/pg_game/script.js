/**
 * The script file needs to implement a beginPeriod function and a beginStage function.
 * The table object will be passed to the stage templates, so that's where to put anything
 * which needs to be displayed to the user.
 */

/**
 * This function is called once at the beginning of each period
 */
exports.beginPeriod = function(table){
    // the endowment is the same for all subjects, so put it in the globals object
    table.globals.endowment = 20;
    table.globals.efficiencyFactor = 1.6;

    // the contribution needs to be zeroed out for each subject
    for (var i = 0; i < table.subjects.length; i++) {
        table.subjects[i].contribution = 0;
    }
}

// This function is called once at the beginning of each stage, stageName is a string
exports.beginStage = function(table,stageName, subjectNum){
    var groupContribution = [];
    if (stageName == "Contribution Entry") {
        // do nothing
    } else if (stageName == "Profit Display") {
        // set the profit value

        groupContribution = sumBy(table.subjects, "contribution", "group");
        // use the above sums to determine each player's profit
        for (var i = 0; i < table.subjects.length; i++) {
            table.subjects[i].profit = +table.globals.efficiencyFactor * +groupContribution[table.subjects[i].group] / +table.globals.groupSize + +table.globals.endowment - +table.subjects[i].contribution;
        }
    }
}

exports.updateData = function(table, stageName, subjectNum, command, data) {
   console.log("inside user function for update table"); 
}

// all helper functions will be requirable by a simple ztree = require("ztree") statement

/**
 * Takes an array and two strings to identify the summand and the grouping parameter
 * TODO support parseInt and parseFloat
 */
var sumBy = function(table, variable, group) {
    var sum = [];
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
