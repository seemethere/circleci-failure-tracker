function setup_breakage_mode_selector() {

	const selector_element = $('#breakage-mode-selector');

	$("#mini-throbber-failure-modes").show();
	$.getJSON('/api/list-failure-modes', function (mydata) {
		$("#mini-throbber-failure-modes").hide();

		selector_element.empty();

		for (var item of mydata) {
			selector_element.append(render_tag("option", item["record"]["label"], {"value": item["db_id"]}));
		}
	});

	return selector_element;
}


function update_breakage_mode(cause_id, new_failure_mode) {

	console.log("updating failure mode to: " + new_failure_mode);

	const data_dict = {"cause_id": cause_id, "mode": new_failure_mode};
	post_modification("/api/code-breakage-mode-update", data_dict);
}
