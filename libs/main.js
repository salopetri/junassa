var trains = {};
var timetables = {};
var id = 0;
var gmaps, marker;

$(function() {
    var user = $.cookie("uid");
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
});

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
                    timetables[train.id] = timetable;
                    $.each(timetable, function(i, station) {
                         if (1*station.arrival > t && nextStation == "") {
                             nextStation = station.station;
                        }
                         console.log(station.arrival + ' : '+t);
                    });
                    $('main').append('<div class="searchResult"><p>'+train.train_type+train.id+' '+train.first_station+' - '+train.last_station+'</p><p class="small">Seuraava asema: '+nextStation+', nopeus: '+train.speed+'km/h</p><button class="trainPicker" onclick="showTrainMonitor('+train.id+')">Valitse</button></div>');
                });
            });
        }
    });
}

function showTrainMonitor(param) {
    id = param;
    var d = new Date();
    var t = d.getTime()/1000;
    $.get("templates/trainMonitor.html", function(page) {
        $('main').html(page);
        $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
            train = train[0];
            $('#trainTitle').text(train.train_type+train.id);
            let nextStation = "";
            $.each(timetables[id], function(i, station) {
                if (1*station.arrival > t && nextStation == "") {
                    nextStation = station.station;
                }
                let arrival = formatTime(station.arrival);
                let arrived = formatTime(station.arrived);
                let departure = formatTime(station.departure);
                let departed = formatTime(station.departed);
                $("#timetable").append('<div class="timetableRow"><h2>'+station.station+'</h2><br><p>Saapuu: '+arrival+' ('+arrived+')<br>Lähtee: '+departure+' ('+departed+')</div>');
            });
            $("#next_station").html("<p>"+nextStation+"</p>");
            $("#speed").html("<p class='big'>"+train.speed+"</p><p class='small'>km/h</p>");
            // The location of Uluru
            let trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};
            // The map, centered at Uluru
            gmaps = new google.maps.Map(
                document.getElementById('map'), {zoom: 10, center: trainpos});
            // The marker, positioned at Uluru
            marker = new google.maps.Marker({position: trainpos, map: gmaps});

            setInterval(updateMonitor, 5000);
        });
    });
}

function updateMonitor() {
    var d = new Date();
    var t = d.getTime()/1000;

    $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
        train = train[0];
        let nextStation = "";
        $.getJSON("get.php?a=getStops&p="+id, function(timetable) {
            timetables[id] = timetable;
            $('#timetable').html("");
            $.each(timetables[id], function(i,station) {
                if (1*station.arrival > t && nextStation == "") {
                    nextStation = station.station;
                }
                let arrival = formatTime(station.arrival);
                let arrived = formatTime(station.arrived);
                let departure = formatTime(station.departure);
                let departed = formatTime(station.departed);
                $("#timetable").append('<div class="timetableRow"><h2>'+station.station+'</h2><br><p>Saapuu: '+arrival+' ('+arrived+')<br>Lähtee: '+departure+' ('+departed+')</div>');
            });
        });
        $("#next_station").html("<p>"+nextStation+"</p>");
        $("#speed").html("<p class='big'>"+train.speed+"</p><p class='small'>km/h</p>");
        let trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};
        gmaps.setCenter(trainpos);
        marker.setPosition(trainpos);
    });
}

function formatTime(timestamp) {
    if (timestamp>0) {
        let d = new Date(timestamp*1000);
        let hours = (d.getHours()<10) ? "0"+d.getHours() : d.getHours();
        let minutes = (d.getMinutes()<10) ? "0"+d.getMinutes() : d.getMinutes();
        return hours+":"+minutes;
    }
    else return "Aikataulun mukaan";
}