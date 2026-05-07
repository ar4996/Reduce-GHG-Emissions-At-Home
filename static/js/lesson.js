$(document).ready(function () {
    const opportunities = JSON.parse($("#room-opportunities-data").text());

    // Apply hotspot positions from data attributes.
    // This avoids putting Jinja variables directly inside an inline style attribute.
    $(".hotspot").each(function () {
        $(this).css({
            left: $(this).data("left"),
            top: $(this).data("top"),
            width: $(this).data("width"),
            height: $(this).data("height")
        });
    });

    const clickedItems = new Set();
    const totalHotspots = $(".hotspot").length;

    $(".hotspot").on("click", function () {
        const itemKey = $(this).data("item");

        const itemData = opportunities.find(function (item) {
            return item.item_key === itemKey;
        });

        if (!itemData) {
            console.warn("No opportunity data found for:", itemKey);
            return;
        }

        clickedItems.add(itemKey);
        $(this).addClass("selected");

        const existingRow = $(`#opportunity-table-body tr[data-item="${itemKey}"]`);

        if (existingRow.length === 0) {
            const newRow = `
                <tr data-item="${itemKey}">
                    <td>${itemData.opportunity}</td>
                    <td>${itemData.description}</td>
                    <td class="co2-data d-none">${itemData.impact}</td>
                </tr>
            `;

            $("#opportunity-table-body").append(newRow);
        }

        // After all hotspots are clicked, show the CO₂ reveal button.
        // The CO₂ data itself is still hidden at this point.
        if (clickedItems.size === totalHotspots) {
            $("#show-co2-container").removeClass("d-none");
        }
    });

    $("#show-co2-btn").on("click", function () {
        // Reveal the CO₂ emissions reduction data in the table.
        $(".co2-data").removeClass("d-none");

        // Hide this button after it is clicked.
        $("#show-co2-container").addClass("d-none");

        // Now show the next room button.
        $("#next-room-container").removeClass("d-none");
    });

    $("#next-room-btn").on("click", function () {
        const nextIndex = $(this).data("next-index");

        if (nextIndex === null || nextIndex === undefined || nextIndex === "None") {
            window.location.href = "/quiz/1";
        } else {
            window.location.href = "/learn/" + nextIndex;
        }
    });

});