var socket = io(window.location.href).connect(); //io.connect affyres
var ingredients = new Array;
var page = 1;



$(document).ready(function() {
    $("#ingInput").keypress(function(e) { //Når vores start-knap bliver trykket
        if(e.which == '13') {
            var item = $(this).val()
            ingredients.push(item)
 
            var item = "<span class='item'>" + item + "</span>";
            var html = $("#ingredients").html()
            $("#ingredients").html(html + item);

            $("#ingredients").children().click(function() {
                var ingr = $(this).html();
                for(i=0; i<ingredients.length; i++) {
                    if(ingredients[i]==ingr) {
                        ingredients.splice(i);
                    }
                }
                $(this).remove()
            })

            $(this).val("");
        }
    });

    $("#search").click(function() {
        search();
    });
});



socket.on("recipe found", function(id, name, o, n) {
    //o = ejer i forvejen
    //n = mangler
    
    console.log(o);
    console.log(n);

    var html = "<div class='opskrift'>(<span style='color: green'>" + o.length + "</span>/<span style='color: red'>" + (parseInt(o.length)+parseInt(n.length)) + ")</span><span class='overskrift'>" + name + "</span><br />"
    html += "<div class='ingredienser'><div class='owns'>Du ejer: <br />"
    for(item of o) {
        html += "<span>" + item + "</span></br>";
    }
    html += "</div>"
    html += "<div class='need'>Du mangler: <br />"
    for(item of n) {
        html += "<span>" + item + "</span></br>";
    }
    html += "</div></div><br />"
    html += "Link til opskrift: <a href='http://www.dk-kogebogen.dk/opskrifter/visopskrift.php?id=" + id + "'>tryk her</a>"
    html += "</div>";

    $("#results").html($("#results").html() + html);
})


function search() {

        if(page==1)
            var html = "Side 1 - <span id='next'>(Næste)</a><br />";
        else
            var html = "<a href='#' id='last'>(Forrige)</a> - Side " + page + " - <a href='#' id='next'>(Næste)</a><br />"
        $("#results").html(html);
        $("#next").click(function() {
            console.log("next");
            page++;
            search();
        })
        $("#last").click(function() {
            page--;
            search();
        })
        socket.emit("search", ingredients, page)
        

}
