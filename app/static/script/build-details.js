function prompt_promote_match(match_id) {

	const data_dict = {
		"match_id": match_id,
	};

	post_modification("/api/promote-match", data_dict);
}


function gen_builds_table(element_id, data_url, height_string, universal_build_id, maybe_circleci_build_id) {

	const column_list = [
		{title: "Line", field: "line_number", width: 100, formatter: function(cell, formatterParams, onRendered) {
			return gen_line_number_cell(cell);
		}},
		{title: "Match (" + render_tag("span", "click to show log context", {"style": "color: #0d0;"}) + ")",
			field: "line_text",
			sorter: "string",
			widthGrow: 8,
			formatter: function(cell, formatterParams, onRendered) {
				return gen_error_cell_html(cell);
			},
			cellClick: function(e, cell){

				const row_data = cell.getRow().getData();

				const provider_build_number = maybe_circleci_build_id || row_data["build_number"];

				const match_id = row_data["match_id"];
				get_log_text(match_id, STANDARD_LOG_CONTEXT_LINECOUNT, universal_build_id, provider_build_number);
			},
		},
		{title: "Pattern", field: "pattern_id", formatter: "link",
			formatterParams: {urlPrefix: "/pattern-details.html?pattern_id="},
			width: 75,
		},
	];

	// Is not the single-entry "best match" table
	if (height_string != null) {

		const additional_columns = [
			{title: "Promote", field: "match_id", 
				formatter: function(cell, formatterParams, onRendered) {
					return link("Promote", "javascript:prompt_promote_match(" + cell.getValue() + ");");
				},
				width: 100,
			},
			{title: "Specificity", field: "specificity", width: 100},
		];

		for (var col of additional_columns) {
			column_list.push(col);
		}
	}

	const table = new Tabulator("#" + element_id, {
		height: height_string,
		layout: "fitColumns",
		placeholder: "No Data Set",
		columns: column_list,
		ajaxURL: data_url,
		ajaxResponse: function(url, params, response) {
			console.log("Loaded DB content for URL '" + data_url + "' in " + response.timing.toFixed(1) + " seconds.");
			return response.content;
		},
	});
}


function render_known_failure(failure_obj) {
	const description = failure_obj["record"]["breakage_description"] ? failure_obj["record"]["breakage_description"] : "<no description>";

	return link(failure_obj["record"]["breakage_description"], "/breakage-details.html?cause=" + failure_obj["db_id"]) + render_list([
		"Broken by " + sha1_link(failure_obj["record"]["breakage_commit"]),
		"Applies to " + pluralize(failure_obj["record"]["jobs"].length, "job"),
	]);
}


function populate_build_info(universal_build_id, parent_data) {

	const data = parent_data["build_info"];

	const circleci_build_id = parent_data["umbrella_build"]["build_record"]["build_id"];

	const logview_items = render_list([
		"View log " + link("on CircleCI", "https://circleci.com/gh/pytorch/pytorch/" + circleci_build_id, true),
	]);

	const full_commit = data["build"]["vcs_revision"];
	const short_commit = full_commit.substring(0, 7);

	const local_link = link("View " + render_tag("code", short_commit) + " details", "/commit-details.html?sha1=" + full_commit);
	const github_link = link("View " + render_tag("code", short_commit) + " on GitHub", "https://github.com/pytorch/pytorch/commit/" + full_commit);
	const commit_links = render_list([local_link, github_link]);

	const breakage_cause_items = render_list(parent_data["known_failures"].map(render_known_failure));


	const items = [
		["Logs:", logview_items],
		["Revision:", commit_links],
		["Build step:", render_tag("i", data["step_name"])],
		["Branch:", data["build"]["branch"]],
		["Job name:", link(data["build"]["job_name"], "/job-details.html?job=" + data["build"]["job_name"])],
		["Known breakage causes:", breakage_cause_items],
		["Date:", moment(data["build"]["queued_at"]).fromNow()],
	];

 	$("#implicate-self-button").click(function (e) {
		$("#input-implicated-revision").val(full_commit);
	});

	$("#implicate-self-button").prop("disabled", false);

        $("#build-info-box").html(render_table_vertical_headers(items));

	if (parent_data["multi_match_count"] > 1) {
		$("#all-matches-section").show();
		gen_builds_table("all-build-matches-table", "/api/build-pattern-matches?build_id=" + universal_build_id, "300px", universal_build_id, circleci_build_id);

	} else if (parent_data["multi_match_count"] == 1) {

		$("#all-matches-section").html(render_tag("p", render_tag("b", "Note:") + " Only 1 pattern match was found in the entire log."));
		$("#all-matches-section").show();

	}
}


function gen_status_notifications_table(element_id, data) {

	var table = new Tabulator("#" + element_id, {
		height:"400px",
		layout:"fitColumns",
		placeholder:"No Data Set",
		columns:[
/*
			{title: "Revision", field: "sha1", width: 100, formatter: function(cell, formatterParams, onRendered) {
				return '<code><a href="/commit-details.html?sha1=' + cell.getValue() + '">' + cell.getValue().substring(0, 7) + '</a></code>';
			}},
*/
			{title: "Time", field: "created_at", formatter: function(cell, formatterParams, onRendered) {
//				return moment(cell.getValue()).fromNow();
				return cell.getValue();
			}},
			{title: "Provider Build number", field: "build_number", 
				formatter: "link",
				formatterParams: {
					urlPrefix: "https://circleci.com/gh/pytorch/pytorch/",
				},
			},
			{title: "State", field: "state", sorter: "string"},
		],
		data: data,
	});
}


function get_status_notifications(job_name, sha1) {

	$.getJSON('/api/list-build-github-status-events', {"job": job_name, "sha1": sha1}, function (data) {

		gen_status_notifications_table("status-notifications-table", data);
	});
}


function get_build_info(universal_build_id) {

	$.getJSON('/api/single-build-info', {"build_id": universal_build_id}, function (data) {
		if (data.success) {
			console.log("Retrieved best match info within '/api/single-build-info' api call in " + data.payload.timing.best_match_retrieval.toFixed(1) + " seconds");
			populate_build_info(universal_build_id, data.payload.content);

			const job_name = data.payload.content["build_info"]["build"]["job_name"];
			const sha1 = data.payload.content["build_info"]["build"]["vcs_revision"];
			get_status_notifications(job_name, sha1);

		} else {
		        $("#build-info-box").html(render_tag("span", "Error: " + data.error.message, {"style": "color: red;"}));
		}
	});
}


function gen_pattern_test_link(universal_build_id) {
        $("#pattern-add-link-container").html( link("Add pattern", "/add-pattern.html?build_id=" + universal_build_id) );
}


function rescan_build(button) {

	const universal_build_id = get_build_number();

	$(button).prop("disabled", true);
	$("#scan-throbber").show();

        $.post({
		url: "/api/rescan-build",
		data: {
			"build": universal_build_id,
			"login_redirect_path": get_url_path_for_redirect(),
		},
		success: function( data ) {

			$(button).prop("disabled", false);
			$("#scan-throbber").hide();

			handle_submission_response(data);
		},
		error: function( data ) {
			$("#scan-throbber").hide();
			alert("Server error!");
		},
        });
}


function get_build_number() {
	const urlParams = new URLSearchParams(window.location.search);
	return urlParams.get('build_id');
}


function main() {

	const universal_build_id = get_build_number();
	const local_logview_item_full = link("View full log", "/api/view-log-full?build_id=" + universal_build_id);
	$("#full-log-link-container").html(local_logview_item_full);

	get_build_info(universal_build_id);
	gen_builds_table(
		"best-build-matches-table",
		"/api/best-build-match?build_id=" + universal_build_id,
		null,
		universal_build_id,
		null);

	gen_pattern_test_link(universal_build_id);
}

