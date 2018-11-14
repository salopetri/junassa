var trains = {};
var timetables = {};
var id = 0;
var gmaps, marker;
var updater;
var user;

$(function() {
    showSearchScreen();
});

function showSearchScreen() {
    if ($.cookie('currentID')) showTrainMonitor($.cookie('currentID'));
    else {
        user = $.cookie("uid");
        if (user) {

        }
        else {
            $.get("templates/search.html", function(data) {
                $('main').html(data);
                $("#query").keypress(function() {
                    setTimeout(function() {
                        $("#query").val($("#query").val().toUpperCase());
                    }, 100);
                });
            });
        }
    }
}

function back() {
    clearInterval(updater);
    $.removeCookie('currentID');
    showSearchScreen();
}

function searchT() {
    var d = new Date();
    var t = d.getTime()/1000;
    $.getJSON("get.php?a=getTrainsByName&p="+$('#query').val(), function(data) {
        if (data.error == "empty response") alert('Palvelinvirhe');
        else {
            $('main').html("");
            $.each(data, function(i, train) {
                trains[train.id] = train;
                $.getJSON("get.php?a=getStops&p="+train.id, function(timetable) {
                    let nextStation = "";
                    let lateSTR = "";
                    timetables[train.id] = timetable;
                    $.each(timetable, function(i, station) {
                        if (station.arrived == 0 && nextStation == "" && station.order>0) {
                            nextStation = station.station;
                            lateSTR = (station.arrival_diff>0) ? ", myöhässä "+station.arrival_diff+" minuuttia." : "";
                            console.log(station.arrival_diff);
                        }
                        else if (nextStation != "" && station.arrived != 0) nextStation = "";
                    });
                    $('main').append('<div class="searchResult"><p>'+train.train_type+train.id+' '+train.first_station+' - '+train.last_station+'</p><p class="small">Seuraava asema: '+nextStation+', nopeus: '+train.speed+'km/h'+lateSTR+'</p><button class="trainPicker" onclick="showTrainMonitor('+train.id+')">Valitse</button></div>');
                });
            });
        }
    });
}

function showTrainMonitor(param) {
    id = param;
    $.cookie('currentID', id);
    var d = new Date();
    var t = d.getTime()/1000;
    $.get("templates/trainMonitor.html", function(page) {
        $('main').html(page);
        $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
            train = train[0];
            $('#trainTitle').text(train.train_type+train.id);
            getTimeTables(train);
            $("#speed").html("<p class='big'>"+train.speed+"</p><p class='small'>km/h</p>");
            // The location of Uluru
            let trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};
            // The map, centered at Uluru
            gmaps = new google.maps.Map(
                document.getElementById('map'), {zoom: 10, center: trainpos});
            // The marker, positioned at Uluru
            marker = new google.maps.Marker({position: trainpos, map: gmaps});

            updater = setInterval(updateMonitor, 5000);
        });
    });
}

function updateMonitor() {
    var d = new Date();
    var t = d.getTime()/1000;

    $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
        train = train[0];
        getTimeTables(train);
        $("#speed").html("<p class='big'>"+train.speed+"</p><p class='small'>km/h</p>");
        let trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};
        gmaps.setCenter(trainpos);
        marker.setPosition(trainpos);
    });
}

function getTimeTables(train) {
    let nextStation = "";
    $.getJSON("get.php?a=getStops&p="+id, function(timetable) {
        timetables[id] = timetable;
        $('#timetable').html("");
        $.each(timetables[id], function(i, station) {
            if (station.train_stopping == 1) {
                let arrival = formatTime(station.arrival);
                let arrived = formatTime(station.arrived);
                let departure = formatTime(station.departure);
                let departed = formatTime(station.departed);
                let fixedArrival = formatTime(1*station.arrival+(station.arrival_diff*60));
                let fixedDeparture = formatTime(station.departure+(station.departure_diff*60));
                let timetableString = '<div class="timetableRow"><h2>'+station.station;
                timetableString += (arrived || departed) ? '&#9989;</h2><br><p>' : '</h2><br><p>';
                timetableString += (arrived) ? 'Saapunut: '+arrived+" <b>(+"+station.arrival_diff+")</b>" : (arrival) ? 'Saapuu: '+arrival : '';
                timetableString += (!arrived && station.arrival_diff>0) ? " <b>("+fixedArrival+")</b>" : "";
                timetableString += '<br>';
                timetableString += (departed) ? 'Lähti: '+departed+" <b>(+"+station.departure_diff+")</b>" : (departure) ? 'Lähtee: '+departure : '';
                timetableString += (!departed && station.departure_diff>0) ? " <b>("+fixedDeparture+")</b>" : "";
                timetableString += '</div>';
                $("#timetable").append(timetableString);
                if (!arrived && nextStation == "" && station.order>0) {
                    nextStation = station.station;
                    let distance = calculateDistance(train.latitude, train.longitude, station.latitude, station.longitude);
                    let nextStationSTR = "<p class='small' style='margin-top:20px;'>Seuraavana:</p><p style='margin-top:20px;'>"+nextStation+"</p>";
                    nextStationSTR += "<p class='small'>"+distance+" km</p>";
                    nextStationSTR += "<p style='margin-top:20px' id='NXTArrival'>"+fixedArrival+"</p>";
                    nextStationSTR += (station.arrival_diff>0) ? "<p class='small'>("+arrival+")</p>" : "";
                    $("#next_station").html(nextStationSTR);
                    if (station.arrival_diff > 0) $("#NXTArrival").css('color', 'red');
                    else $("#NXTArrival").css('color', 'green');
                }
                else if (nextStation != "" && arrived) nextStation = "";
            }
        });
    });
}

function formatTime(timestamp) {
    if (timestamp>0) {
        let d = new Date(timestamp*1000);
        let hours = (d.getHours()<10) ? "0"+d.getHours() : d.getHours();
        let minutes = (d.getMinutes()<10) ? "0"+d.getMinutes() : d.getMinutes();
        return hours+":"+minutes;
    }
    else return false;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    var ED = 6371e3;
    var latRad1 = DegreesToRadians(lat1);
    var latRad2 = DegreesToRadians(lat2);
    var diffLat = DegreesToRadians(lat2-lat1);
    var diffLon = DegreesToRadians(lon2-lon1);

    var a = Math.sin(diffLat/2) * Math.sin(diffLat/2) +
            Math.cos(latRad1) * Math.cos(latRad2) *
            Math.sin(diffLon/2) * Math.sin(diffLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    // Return distance in kilometers with .1 precision
    return Math.floor((ED * c)/100)/10;
}

function DegreesToRadians(degrees) {
    return degrees * (Math.PI/180);
}
