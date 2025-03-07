
function breakages_gantt_highchart(api_data) {

	const series_data = [];

/*
	series_data.push({
		    start: Date.UTC(2019, 6, 1),
		    end: Date.UTC(2019, 7, 1),
		    name: 'Fake span'
		};
*/

	for (var datum of api_data.annotated_master) {
		const entry = {
			start: Date.parse(datum.span.start),
			end: Date.parse(datum.span.end),
			name: 'Annotated breakages',
			prNumber: datum.pr,
		}

		if (datum.foreshadowed_by_pr_failures) {
			entry["color"] = "red";
		}

		series_data.push(entry);
	}


	for (var datum of api_data.dirty_master) {
		const entry = {
			start: Date.parse(datum.span.start),
			end: Date.parse(datum.span.end),
			name: 'All failures',
		}

		series_data.push(entry);
	}


	Highcharts.ganttChart('breakage-spans-gantt-container', {
		title: {
			text: 'Master breakages'
		},
		tooltip: {
			pointFormat: '<span>PR <a href="' + PULL_REQUEST_URL_PREFIX + '{point.prNumber}">#{point.prNumber}</a></span><br/><span>From: {point.start:%e. %b}</span><br/><span>To: {point.end:%e. %b}</span>'
		},
		xAxis: {
			startOfWeek: 0, // XXX doesn't work, despite documentation: https://api.highcharts.com/gantt/xAxis.startOfWeek
		},
		yAxis: {
			uniqueNames: true
		},
		navigator: {
			enabled: true,
			liveRedraw: true,
			series: {
				type: 'gantt',
				pointPlacement: 0.5,
				pointPadding: 0.25
			},
			yAxis: {
				min: 0,
				max: 3,
				reversed: true,
				categories: []
			}
		},
		credits: {
			enabled: false
		},
		scrollbar: {
			enabled: true
		},
		rangeSelector: {
			enabled: true,
			selected: 0
		},
		series: [{
			name: 'Master branch viability',
			data: series_data,
		}],
	});
}


function master_breakages_timeline_highchart(chart_id, data) {

	const unavoidable_master_breakages = [];
	const avoidable_master_breakages = [];

	for (var datum of data) {

		const week_val = Date.parse(datum["timestamp"]);

		unavoidable_master_breakages.push([week_val, datum["record"]["distinct_breakages"] - datum["record"]["avoidable_count"]]);
		avoidable_master_breakages.push([week_val, datum["record"]["avoidable_count"]]);
	}

	const series_list = [];

	series_list.push({"name": "Breakage-affected builds not visible in PR", data: unavoidable_master_breakages})
	series_list.push({"name": "Breakage-affected builds appeared in PR", data: avoidable_master_breakages})


	Highcharts.chart(chart_id, {
		chart: {
			type: 'area',
		},
		colors: ["#5cf180", "#f15c80"],
		title: {
			text: 'Master breakage avoidability by month',
		},
		subtitle: {
			text: 'Note: last month is partial'
		},
		xAxis: {
			type: 'datetime',
			dateTimeLabelFormats: { // don't display the dummy year
				month: '%e. %b',
				year: '%b'
			},
			title: {
				text: 'Date'
			}
		},
		yAxis: {
			title: {
				text: 'Breakages by month'
			},
			min: 0
		},
		plotOptions: {
			line: {
				marker: {
					enabled: true
				}
			},
			area: {
			    stacking: "normal",
			},
		},
		credits: {
			enabled: false
		},
		series: series_list,
	});
}


function pr_merges_timeline_highchart(chart_id, data, stacking_type, y_label_prefix) {

	const succeeding_pr_merges_points = [];
	const failing_pr_merges_points = [];
	const failing_pr_foreshadowing_breakage_points = [];

	for (var datum of data) {

		const week_val = Date.parse(datum["timestamp"]);

		succeeding_pr_merges_points.push([week_val, datum["record"]["total_pr_count"] - datum["record"]["failing_pr_count"]]);
		failing_pr_merges_points.push([week_val, datum["record"]["failing_pr_count"] - datum["record"]["foreshadowed_breakage_count"]]);
		failing_pr_foreshadowing_breakage_points.push([week_val, datum["record"]["foreshadowed_breakage_count"]]);
	}

	const series_list = [];

	series_list.push({"name": "All builds succeeded", data: succeeding_pr_merges_points})
	series_list.push({"name": "Some builds failed (benign master impact)", data: failing_pr_merges_points})
	series_list.push({"name": "Some build failures foreshadowed master breakage", data: failing_pr_foreshadowing_breakage_points})


	const foreshadowed_breakage_high_water_mark = Math.max(...(failing_pr_foreshadowing_breakage_points.map(x => x[1])))

	const y_axis_plotlines = [];

	if (stacking_type != "percent") {
		y_axis_plotlines.push({
			color: 'red', // Color value
			dashStyle: 'longdashdot', // Style of the plot line. Default to solid
			value: foreshadowed_breakage_high_water_mark, // Value of where the line will appear
			width: 2 // Width of the line    
		});
	}


	Highcharts.chart(chart_id, {
		chart: {
			type: 'area', // TODO use "step"
		},
		colors: ["#5cf180", "#f1f180", "#f15c80"],
		title: {
			text: 'PR Merges by week (' + y_label_prefix + ')',
		},
		subtitle: {
			text: 'Showing only full weeks, starting on labeled day'
		},
		xAxis: {
			type: 'datetime',
			dateTimeLabelFormats: { // don't display the dummy year
				month: '%e. %b',
				year: '%b'
			},
			title: {
				text: 'Date'
			}
		},
		yAxis: {
			title: {
				text: y_label_prefix + ' by week'
			},
			min: 0,
			plotLines: y_axis_plotlines,
		},
		plotOptions: {
			line: {
				marker: {
					enabled: true
				}
			},
			area: {
			    stacking: stacking_type,
			},
		},
		credits: {
			enabled: false
		},
		series: series_list,
	});
}


function render_master_commits_plots() {

	getJsonWithThrobber("#scan-throbber", "/api/master-commits-granular", {}, breakages_gantt_highchart)

	getJsonWithThrobber("#scan-throbber2", "/api/master-pr-merge-time-weekly-failure-stats", {"weeks": 26}, function (data) {
		pr_merges_timeline_highchart("pr-merges-by-week-stacked", data, "normal", "count");
		pr_merges_timeline_highchart("pr-merges-by-week-percent", data, "percent", "percent");
	});

	getJsonWithThrobber("#scan-throbber3", "/api/master-breakages-monthly-stats", {}, function (data) {
		master_breakages_timeline_highchart("avoidable-breakages-by-month-stacked", data);
	});
}


function main() {
	render_master_commits_plots();
}

