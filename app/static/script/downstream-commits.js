
function gen_good_commits_table(element_id, data_url) {

	const column_list = [
		{title: "Commit", field: "sha1", width: 100, formatter: function(cell, formatterParams, onRendered) {
			    return sha1_link(cell.getValue());
			},
		},
		{title: "Distance", field: "distance", width: 100,
		},
	];

	const table = new Tabulator("#" + element_id, {
		layout: "fitColumns",
		placeholder: "No Data Set",
		columns: column_list,
		ajaxURL: data_url,
	});
}


function populate_form_from_url() {

	const urlParams = new URLSearchParams(window.location.search);
	var commit_sha1 = urlParams.get('sha1');
	$("#master-commit-sha1").val(commit_sha1);
}


function requery_table() {
	const commit_sha1 = $("#master-commit-sha1").val();

	gen_good_commits_table("downstream-commits-table", "/api/master-downstream-commits?sha1=" + commit_sha1);
}


function main() {

	populate_form_from_url();
	requery_table();
}

