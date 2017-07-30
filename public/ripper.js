//require('jquery');
//require("socket.io-client");

var socket = io(window.location.href).connect(); //io.connect affyres
var req = false; //Boolean til at håndtere om programmet er pauset eller ej

$(document).ready(function() {
    $("#startbtn").click(function() { //Når vores start-knap bliver trykket
        req = !req; //Bolean sættes til det modsatte
        newReq(); //newReq kaldes

    });

});


socket.on("success", function() { //Klienten modtog en "sucess" besked fra serveren
    var id = $("#startid").val(); //Det gamle id indlæses
    $("#startid").val(parseInt(id)+1); //Det opdateres automatisk med +1
    newReq(); //newReq kaldes igen
}) 

function newReq() {
    if(!req) //hvis vores boolean er false, stopper programmet
        return;
    
    var id = $("#startid").val(); //Id indlæses fra vores input
    //kort debug kode for at kunne holde styr på hvor i processen programmet er nået
    var msg = "<span class='newMessage'>sending req on id " + id + "</span><br />";
    //Det indsættes i vores "chatcont" div tag:
    $("#chatcont").html($("#chatcont").html() + msg);
    socket.emit("new req", id); //En besked sendes til serveren om at indlæse en ny opskrift
}
