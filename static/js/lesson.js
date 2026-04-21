$(document).ready(function() {

  let clickedOnce = false;

  $("#impact-btn").click(function() {


    if (!clickedOnce) {
        
        const impactDiv = $(".impact-opportunity");

        impactDiv.prepend("<p>" + impact_text + "</p>" + "<p> Emissions Impact Cost Effectiveness: " + cost_effectiveness + "</p>");

        if (next_index === null) {
            $(this).text("Congrats on finishing. Test yourself!");
        } else {
        $(this).text("Go to the " + next_room);
        }

        $(this)
            .removeClass("btn-primary")
            .addClass("btn-success");
        
        clickedOnce = true;
    } else {
        if (next_index === null) {
          window.location.href = "/quiz/binary";
        } else {
          window.location.href = "/learn/" + next_index;
        }
    }

  });

});
