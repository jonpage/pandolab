/**
 * The script file needs to implement a beginPeriod function and a beginStage function.
 * The table object will be passed to the stage templates, so that's where to put anything
 * which needs to be displayed to the user.
 */

/**
 * This function is called once at the beginning of each period
 */
exports.beginPeriod = function(table){
    table.globals.minGuess = 0;
    table.globals.maxGuess = 100;
    table.globals.incGuess = 0.001;
    table.globals.factor = 2/3;
    table.globals.prize = 50;
}

// This function is called once at the beginning of each stage, stageName is a string
exports.beginStage = function(table,stageName, subjectNum){
    var groupContribution = [];
    if (stageName == "Guess") {
        // do nothing
    } else if (stageName == "Profit Display") {
        // set the profit value
        
        // grab average values of guess
        var groupAverages = avgBy(table.subjects, "guess", "group");
        // assign averages to each subject  
        for (var i = 0; i < table.subjects.length; i++) {
            table.subjects[i].groupAverage = groupAverages[table.subjects[i].group];
            table.subjects[i].targetValue = table.subjects[i].groupAverage * table.globals.factor;
            table.subjects[i].diff = Math.abs(table.subjects[i].guess - table.subjects[i].targetValue);
        }
        
        // grab the minimum differences
        var bestDiffs = minBy(table.subjects, "diff", "group");
        // assign bestDiff and test for winners
        for (i = 0; i < table.subjects.length; i++) {
            table.subjects[i].bestDiff = bestDiffs[table.subjects[i].group];
            table.subjects[i].isWinner = (table.subjects[i].diff - table.subjects[i].bestDiff) < table.globals.incGuess ? 1 : 0;
        }

        // grab number of winners
        var numWinners = sumBy(table.subjects, "isWinner", "group");
        // assign numWinners and profit
        for (i = 0; i < table.subjects.length; i++) {
            table.subjects[i].numWinners = numWinners[table.subjects[i].group];
            table.subjects[i].profit = table.globals.prize * table.subjects[i].isWinner / table.subjects[i].numWinners;
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

