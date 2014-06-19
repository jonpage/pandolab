/*
 * This file handles behavior of the session manager view
 */
// connect to server (SockJS)
var shortCode = $('#codeSpan').text();
var sock = new SockJS('/manager/' + shortCode);
var timer_interval = false;
var displayed_tables = [];
var openTreatments = [];
var activeTreatment = "";

// update the listeners for the remove treatment buttons
var updateRemoveTreatmentListeners = function() {
    // remove listeners to avoid duplicate handler calls
    $('.remove-treatment').off('click');

    $('.remove-treatment').on('click', function(e){
        // send the treatment to be removed to the server
        // first check to make sure this treatment is not running.
        var treatmentIndex = (+$(this).parent().siblings().text() - 1);
        if (!openTreatments[treatmentIndex].running) {
            sock.send(JSON.stringify({messageName: 'removeTreatment', treatment: treatmentIndex}));
            $(this).parent().parent().remove();
        }
    });
};

// show progress bar while actively uploading, then hide it once the upload is complete.
$(function() {
    $('.progress').hide();
    $('#fileupload').fileupload({
        dataType: 'json',
        progressall: function (e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10);
            $('.progress-bar').css(
                'width',
                progress + '%'
            ).attr("aria-valuenow",progress).children().html(progress + "% Complete");
        },
        add: function (e, data) {
            // this should be placed in the modal window somewhere
            $('.progress').show();
            data.submit();
        },
        done: function (e, data) {
            for (var i = 0; i < data.files.length; i++) {
                $("#availableTreatments").append("<option value='" + availableTreatments[i] + "'>" + data.files[i].name.replace(/\.zip$/,"") + "</option>");
            }
            sock.send(JSON.stringify({messageName: "getTreatments"}));
            $('.progress').hide();
        }
    });
});

// handler for deleting treatments
$('#deleteSelectedTreatments').click(function(){
    console.log("attempting to delete treatments");
    var selectedTreatments = $('#availableTreatments').val() || [];
    sock.send(JSON.stringify({messageName: "deleteTreatments", treatments: selectedTreatments}));
});

// listener for treatment add
$("#addSelectedTreatments").click(function(){
    // grab the list of selected treatment names
    var selectedTreatments = $("#availableTreatments").val() || [];
    var treatmentString;
    for (var i = 0; i < selectedTreatments.length; i++) {
        // add the selected treatments to the list of currently open treatments
        // active: true => this is the treatment that would be started or is already running.
        openTreatments.push({name: selectedTreatments[i], active: false, running: false, finished: false});
    }

    // determine which treatment should be active
    var isActive = false; // indicator to determine if there is a currently active treatment
    var lastFinished = -1;
    for (i = 0; i < openTreatments.length; i ++) {
        if (openTreatments[i].finished === true) {
            lastFinished = i;
            // fix running and active flags for finished treatments
            openTreatments[i].active = false;
            openTreatments[i].running = false;
        }
        if (openTreatments[i].active === true) {
            isActive = true;
        }
    }
    // set the active treatment to the first treatment that has not finished if there is not already an active treatment
    if (!isActive) {
       openTreatments[lastFinished+1].active = true;
    }


    // redraw all rows
    $("#addTreatmentRow").siblings().remove();
    for (i = 0; i < openTreatments.length; i++){
        if (openTreatments[i].active === true) {
            // treatmentString = "<tr class='success'><td class='dropdown'><span>" + (i+1) + "</span>";
            treatmentString = "<tr class='success'><td>" + (i+1) + "</td>";
        } else if (openTreatments[i].finished === true) {
            treatmentString = "<tr class='warning'><td>" + (i+1) + "</td>";
        } else {
            // treatmentString = "<tr><td class='dropdown'><span>" + (i+1) + "</span>";
            treatmentString = "<tr><td>" + (i+1) + "</td>";
        }
        // treatmentString += "<a href='#' class='btn dropdown-toggle' data-toggle='dropdown'><span class='glyphicon glyphicon-resize-vertical'></span></a>";
        // treatmentString += "<ul class='dropdown-menu' role='menu'>";
        // for (var k = 1; k <= openTreatments.length; k++) {
            // treatmentString += "<li><a href='#'>" + k + "</a></li>"; 
        // }
        // treatmentString += "</ul></td>";
        // treatmentString += "<td><a href='#' class='btn activate-treatment'>" + openTreatments[i].name + "</a>";
        treatmentString += "<td>" + openTreatments[i].name;
        treatmentString += "<button type='button' class='close remove-treatment' aria-hidden='true'>&times;</button></td></tr>";
        $("#addTreatmentRow").before(treatmentString);
    } 

    // $(".dropdown-toggle").on('click', function(e){
    //     e.stopPropagation();
    //     $(this).dropdown();
    //     return false;
    // });

    // add handler for the swap click
    // $("#addTreatmentRow").siblings().find('td ul li a').off('click').on("click", function(e){
    //     // e.stopPropagation();
    //     // alert("swap " + $(this).parent().parent().parent().parent().index() + " with " + (+$(this).text()-1));
    //     sock.send(JSON.stringify({messageName: 'swapOpenTreatments', swap: [$(this).parent().parent().parent().parent().index(), (+$(this).text()-1)]}));
    // });

    // update the row listeners for highlighting the active treatment
    // $(".activate-treatment").off('click').on('click', function(e){
    //     var clickedTreatment = (+$(this).parent().siblings().first().children().first().text() - 1);

    //     // determine if a treatment is running
    //     var runningTreatment = false;
    //     for (var i = 0; i < openTreatments.length; i++) {
    //         if (openTreatments[i].running === true) {
    //             runningTreatment = true;
    //         }
    //     }

    //     // only change the active treatment if it is not already active and no other treatment is running
    //     if (openTreatments[clickedTreatment].active === false && runningTreatment === false) {
    //         $(this).parent().parent().siblings().removeClass('success');
    //         openTreatments[clickedTreatment].active = true;
    //         // send update to the surver to make this the active treatment
    //         sock.send(JSON.stringify({messageName: 'setActiveTreatment', treatment: clickedTreatment}));
    //     }
    // });

    // update the close button handlers
    updateRemoveTreatmentListeners();
    // add these treatments to the treatments table
    // alert("value of openTreatments = " + openTreatments);
    // update the server with the current list of openTreatments;
    sock.send(JSON.stringify({messageName: "openTreatments", openTreatments: openTreatments}));
});

$("#subject-url").val(document.URL.replace("manager","subject"));
$( function() {
    $('#measure').text($(this).val())
    $(this).css("width", ($('#measure').width() + 16) + "px");
    $('#measure').text("");
});
$("#subject-url").click(function() {
    $(this).select();
});

// start treatment button listener
$("#start").click(function(){
    console.log("startTreatment clicked (browser)");
    // make the active treatment running
    for (var i = 0; i < openTreatments.length; i++) {
        if (openTreatments[i].active === true) {
            openTreatments[i].running = true;
        }
    }
    // later this should be startSession
    // and the core mgr html will not be loaded each time (especially not for the ui)
    // this emit could send the selected treatment
    sock.send(JSON.stringify({messageName: "startTreatment"}));
});

$("#stop").click(function(){
    console.log("stopTreatment clicked (browser)");
    sock.send(JSON.stringify({messageName: "stopTreatment"}));
    clearInterval(timer_interval);
    timer_interval = false;
});

// test connection
sock.onopen = function () {console.log("connection to SockJS openned.");};
sock.onclose = function () {console.log("connection to SockJS closed.");};

// handle screen updates
sock.onmessage = function (e) {
    // test message is received
    console.log("[.] message: " + e.data);
    var data = JSON.parse(e.data);
    var treatmentString = "";
    // receive error from the trying to start/run a treatemtn
    if (data.messageName == "error") {
       $(".treatment-error").empty();
       if (data.error.hasOwnProperty("annotated")){
           $(".treatment-error").html("<div class='alert alert-danger alert-dismissable'><button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;</button><p><strong>Error:</strong></p><p><pre>" + data.error.annotated + "</pre></p></div>");
       } else {
           $(".treatment-error").html("<div class='alert alert-danger alert-dismissable'><button type='button' class='close' data-dismiss='alert' aria-hidden='true'>&times;</button><p><strong>Error:</strong> " + data.error + "</p></div>");

       }
    } else if (data.messageName == "availableTreatments") {
        // alert("adding availableTreatmnets " + data.availableTreatments);
        var availableTreatments = data.availableTreatments;
        $("#availableTreatments").empty();
        for (var i = 0; i < availableTreatments.length; i++) {
            $("#availableTreatments").append("<option value='" + availableTreatments[i] + "'>" + availableTreatments[i] + "</option>");
        }
    } else if (data.messageName == 'treatmentEnded') {

        openTreatments = data.openTreatments;
$("#addTreatmentRow").siblings().remove();
for (var i = 0; i < openTreatments.length; i++) {
    if (openTreatments[i].active === true) {
        // treatmentString = "<tr class='success'><td class='dropdown'><span>" + (i+1) + "</span>";
        treatmentString = "<tr class='success'><td>" + (i+1) + "</td>";
    } else if (openTreatments[i].finished === true) {
        treatmentString = "<tr class='warning'><td>" + (i+1) + "</td>";
    } else {
        // treatmentString = "<tr><td class='dropdown'><span>" + (i+1) + "</span>";
        treatmentString = "<tr><td>" + (i+1) + "</td>";
    }
    // treatmentString += "<a href='#' class='btn dropdown-toggle' data-toggle='dropdown'><span class='glyphicon glyphicon-resize-vertical'></span></a>";
    // treatmentString += "<ul class='dropdown-menu' role='menu'>";
    // for (var k = 1; k <= openTreatments.length; k++) {
    //     treatmentString += "<li><a href='#'>" + k + "</a></li>"; 
    // }
    // treatmentString += "</ul></td>";
    // treatmentString += "<td><a href='#' class='btn activate-treatment'>" + openTreatments[i].name + "</a>";
    treatmentString += "<td>" + openTreatments[i].name;
    treatmentString += "<button type='button' class='close remove-treatment' aria-hidden='true'>&times;</button></td></tr>";
    $("#addTreatmentRow").before(treatmentString);
}
updateRemoveTreatmentListeners();

    } else if (data.messageName == 'openTreatments') {
        openTreatments = data.openTreatments;
        // rebuild the list of openTreatments
        $("#addTreatmentRow").siblings().remove();
        for (var i = 0; i < openTreatments.length; i++) {
            if (openTreatments[i].active) {
                // treatmentString = "<tr class='success'><td class='dropdown'><span>" + (i+1) + "</span>";
                treatmentString = "<tr class='success'><td>" + (i+1) + "</td>";
            } else if (openTreatments[i].finished === true) {
                treatmentString = "<tr class='warning'><td>" + (i+1) + "</td>";
            } else {
                treatmentString = "<tr><td>" + (i+1) + "</td>";
            }
            // treatmentString += "<a href='#' class='btn dropdown-toggle' data-toggle='dropdown'><span class='glyphicon glyphicon-resize-vertical'></span></a>";
            // treatmentString += "<ul class='dropdown-menu' role='menu'>";
            // for (var k = 1; k <= openTreatments.length; k++) {
            //     treatmentString += "<li><a href='#'>" + k + "</a></li>"; 
            // }
            // treatmentString += "</ul></td>";
            // treatmentString += "<td><a href='#' class='btn activate-treatment'>" + openTreatments[i].name + "</a>";
            treatmentString += "<td>" + openTreatments[i].name;
            treatmentString += "<button type='button' class='close remove-treatment' aria-hidden='true'>&times;</button></td></tr>";
            $("#addTreatmentRow").before(treatmentString);
        }
        updateRemoveTreatmentListeners();

        // $('.dropdown-toggle').on('click', function(e){
        //     e.stopPropagation();
        //     $(this).dropdown();
        //     return false;
        // });

        // $("#addTreatmentRow").siblings().find('td ul li a').off().on("click", function(e){
        //     // e.stopPropagation();
        //     // alert("swap " + $(this).parent().parent().parent().parent().index() + " with " + (+$(this).text()-1));
        //     sock.send(JSON.stringify({messageName: 'swapOpenTreatments', swap: [$(this).parent().parent().parent().parent().index(), (+$(this).text()-1)]}));
        // });

        // update the row listeners for highlighting the active treatment
        // $(".activate-treatment").off('click').on('click', function(e){
        //     var clickedTreatment = (+$(this).parent().siblings().first().children().first().text() - 1);

        //     // determine if a treatment is running
        //     var runningTreatment = false;
        //     for (var i = 0; i < openTreatments.length; i++) {
        //         if (openTreatments[i].running === true) {
        //             runningTreatment = true;
        //         }
        //     }

        //     // only change the active treatment if it is not already active and no other treatment is running
        //     if (openTreatments[clickedTreatment].active === false && runningTreatment === false) {
        //         $(this).parent().parent().siblings().removeClass('success');
        //         openTreatments[clickedTreatment].active = true;
        //         // send update to the surver to make this the active treatment
        //         sock.send(JSON.stringify({messageName: 'setActiveTreatment', treatment: clickedTreatment}));
        //     }
        // });
    } else if (data.messageName === 'update') {

    // update clients table
    var clients_table = "";
    var callTimer = false;
    var addAssignmentBtn = false;
    if (typeof data.clients !== 'undefined') {
        // count number of subjectNums assigned to clients who have dropped
        // and count number of available clients
        // if both numbers are strictly positive, then display transfer button at available client's subjectNum
        var droppedSubjects = [];
        var availableClients = [];
        for (var i = 0; i < data.clients.length; i++) {
            if ((data.clients[i].subjectNum === false || typeof data.clients[i].subjectNum === 'undefined') && data.clients[i].connected == true) {
                // this client is available
                availableClients.push(i);
            } else if (typeof data.clients[i].subjectNum !== 'undefined' && data.clients[i].subjectNum !== false && data.clients[i].connected == false) {
                droppedSubjects.push(data.clients[i].subjectNum);
            }
            if (data.clients[i].active === true) {
                callTimer = true;
                if (data.clients[i].connected === false) {
                    clients_table += "<tr class='danger'>";
                } else {
                    clients_table += "<tr class='success'>";
                }
                clients_table += "<td>" + data.clients[i].subjectNum + "</td><td>" + i + "</td><td>" + data.clients[i].period + "</td><td>" + data.clients[i].stageName + "</td><td class='timer'>" + data.clients[i].time + "</td></tr>";
            } else {
                if (data.clients[i].connected === false) {
                    clients_table += "<tr class='danger'>";
                } else {
                    clients_table += "<tr class='warning'>";
                }
                if (data.clients[i].subjectNum === false || typeof data.clients[i].subjectNum === 'undefined') {
                    if (data.clients[i].connected === false) {
                        clients_table += "<td>-";
                    } else {
                        clients_table += "<td class='available-client-" + i + "'>-";
                    }
                } else {
                    clients_table += "<td>" + data.clients[i].subjectNum;
                }
                clients_table += "</td><td>" + i + "</td><td>" + data.clients[i].period + "</td><td>" + data.clients[i].stageName + "</td><td>" + data.clients[i].time + "</td></tr>";
            }
        }
        // see if length of droppedSubjects and availableClients are both greater than 0
        if (droppedSubjects.length >= 1 && availableClients.length >= 1) {
            addAssignmentBtn = true;
        }
    }

    // console.log(clients_table);
    $("#clients table tbody").html(clients_table);
    if (addAssignmentBtn) {
        for (var j = 0; j < availableClients.length; j++) {
            var assignmentHTML = "";
            assignmentHTML += "<div class='btn-group available-client'><button type='button' class='btn btn-default dropdown-toggle' data-toggle='dropdown'>Assign <span class='caret'></span></button><ul class='dropdown-menu' role='menu' style='position:relative;'>";
            for (var k = 0; k < droppedSubjects.length; k++) {
                assignmentHTML += "<li><a href='#'>" + droppedSubjects[k] + "</a></li>"; 
            }
            assignmentHTML += "</ul></div>";
            $(".available-client-" + availableClients[j]).html(assignmentHTML);
        }
    }
    $('.available-client ul li a').click(function(){
        var clientID = +$(this).parent().parent().parent().parent().next().text();
        var subjectID = +$(this).text();
        console.log("clientID = " + clientID);
        console.log("subjectID = " + subjectID);
        // send the info to the server
        sock.send(JSON.stringify({messageName: "assignClient", clientNum: clientID, subjectNum: subjectID}));
        return false;
    });
    if (callTimer && timer_interval === false) {
        timer_interval = setInterval(decrementTimers, 1000);
    } else if (!callTimer) {
        clearInterval(timer_interval);
        timer_interval = false;
    }

    // for table in tables see if it already appears in the accordian, 
    // if so swap out the html, if not create the entire accordian group
    // for subjects, global, and session, use a standard order for the defualt variables
    // each time a new variable is encountered, store it in an array so that the order is not 
    // changed each time the content is updated
    //  ...
    var table_string = "";
    // console.log(data.tables);
    for (table in data.tables) {
        if (data.tables.hasOwnProperty(table)) {
            // console.log("table: " + table);
            table_string = "";
            if (displayed_tables.indexOf(table) < 0) {
                // in this case the table has not yet been added. 
                // copy the overall structure from the clients table
                console.log($(".panel").first().clone()
                            .children(".panel-heading").children("h3").children("a")
                            .attr("data-target","#" + table)
                            .attr("href","#" + table)
                            .text(table.charAt(0).toUpperCase() + table.slice(1))
                            .parent().parent().siblings(".panel-collapse").attr("id", table).removeClass("in")
                            .parent().appendTo("#tables"));
                            console.log("try to add div");
                            // add to a list so I know not to add it again
                            displayed_tables.push(table);
            } else {
                // table has been added, just need to upload the replacement data
                console.log("didn't have to add div");

            }
            // craft the table contents
            // check to see if this table is an array (i.e. if there should be multiple rows)
            if($.isArray(data.tables[table])) {
                // this table has multiple rows
                // build the header first
                table_string = "<div class='panel-body'><table class='table table-hover'><thead><tr>";
                for (variable in data.tables[table][0]) {
                    table_string += "<th>" + variable + "</th>";
                }
                table_string += "</tr></thead>";

                // build the table body
                table_string += "<tbody>";
                for (row in data.tables[table]) {
                    table_string += "<tr>";
                    for (column in data.tables[table][row]) {
                        if (data.tables[table][row].hasOwnProperty(column)) {
                            table_string += "<td>" + data.tables[table][row][column] + "</td>";
                        }
                    }
                    table_string += "</tr>";
                }
                table_string += "</tbody></table>";

            } else {
                // this table does not have multiple rows
                table_string = "<table class='table table-hover'><thead><tr>";
                for (value in data.tables[table]) {
                    if (data.tables[table].hasOwnProperty(value)) {
                        table_string += "<th>" + value + "</th>";
                    }
                }
                table_string += "</tr></thead>";

                // build the table body
                table_string += "<tbody><tr>";
                for (value in data.tables[table]) {
                    if (data.tables[table].hasOwnProperty(value)) {
                        table_string += "<td>" + data.tables[table][value] + "</td>";
                    }
                }
                table_string += "</tr></tbody></table></div>";
            }

            // load the table in place
            $("#" + table).html(table_string);

        }
    }

    // ... then build all other tables

    // reset button types
    // $("button").attr("type", "button");
    // $("[type='submit']").attr("type", "button");
    }
}

// Decrement timer values by 1
var decrementTimers = function() {
    $(".timer").text(function(index, oldText) {
        return isNaN(+oldText) ? 0 : +oldText - 1;
    });
}


