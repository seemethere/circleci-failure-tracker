// global
const ranges_by_week = {};

function normalized_build_failure_count_highchart(series_list) {

	Highcharts.chart('container-normalized-build-failures-by-week', {
		chart: {
			type: 'line'
		},
		title: {
			text: 'Build failures on master by Week'
		},
		colors: ["#8085e9", "#b0b0b0"],
		subtitle: {
			text: 'Showing only full weeks, starting on labeled day<br/>Note: includes commits that were not built'
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
		yAxis: [
			{
				title: {
					text: 'commits',
				},
				opposite: true,
				min: 0,
			},
			{
				title: {
					text: 'build failure rate'
				},
				min: 0,
			},
		],
		tooltip: {
			useHTML: true,
			style: {
				pointerEvents: 'auto'
			},
			pointFormatter: function() {
				const commit_id_bounds = ranges_by_week[this.x]["commit_id_bound"];

				const parms_string = $.param({
					"min_commit_index": commit_id_bounds["min_bound"],
					"max_commit_index": commit_id_bounds["max_bound"],
				});

				const link_url = "/master-timeline.html?" + parms_string;

				const y_val = this.series.name == "Commit count" ? this.y : this.y.toFixed(2);
				const content = y_val + "<br/>" + link("(details)", link_url);
				return content;
			},
		},
		plotOptions: {
			line: {
				marker: {
					enabled: true
				}
			},
		},
		credits: {
			enabled: false
		},
		series: series_list,
	});
}


function normalized_commit_failure_count_highchart(series_list) {

	Highcharts.chart('container-normalized-commit-failures-by-week', {
		chart: {
			type: 'line'
		},
		title: {
			text: 'Commits on master with failures by Week'
		},
		colors: ["#f08080", "#b0b0b0"],
		subtitle: {
			text: 'Showing only full weeks, starting on labeled day<br/>Note: includes commits that were not built'
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
		yAxis: [
			{
				title: {
					text: 'commits',
				},
				opposite: true,
				min: 0,
			},
			{
				title: {
					text: 'commit failure rate'
				},
				min: 0,
			},
		],
		tooltip: {
			useHTML: true,
			style: {
				pointerEvents: 'auto'
			},
			pointFormatter: function() {
				const commit_id_bounds = ranges_by_week[this.x]["commit_id_bound"];
				const link_url = "/master-timeline.html?min_commit_index=" + commit_id_bounds["min_bound"] + "&max_commit_index=" + commit_id_bounds["max_bound"];

				const y_val = this.series.name == "Commit count" ? this.y : this.y.toFixed(2);
				const content = y_val + "<br/>" + link("(details)", link_url);
				return content;
			},
		},
		plotOptions: {
			line: {
				marker: {
					enabled: true
				}
			},
		},
		credits: {
			enabled: false
		},
		series: series_list,
	});
}


function separated_causes_column_highchart(columns, column_chart_series, color_key) {

	const series_list = [];
	for (var key in column_chart_series) {
		const points = column_chart_series[key];

		series_list.push({
			name: key.replace(new RegExp("_", 'g'), " "),
			data: points,
			color: color_key[key],
		});
	}


	Highcharts.chart('container-column-separated-occurrences-by-week', {
		chart: {
			type: 'column'
		},
		title: {
			text: 'Failure Modes by Week (per commit)'
		},
		subtitle: {
			text: 'Showing only full weeks, starting on labeled day'
		},
		xAxis: {
			categories: columns,
			crosshair: true
		},
		yAxis: {
			min: 0,
			title: {
				text: 'counts per commit'
			}
		},
		tooltip: {
			headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
			pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
				'<td style="padding:0"><b>{point.y:.2f}</b></td></tr>',
			footerFormat: '</table>',
			shared: true,
			useHTML: true
		},
		plotOptions: {
			column: {
				pointPadding: 0.2,
				borderWidth: 0
			}
		},
		series: series_list,
	});
}


function separated_causes_timeline_highchart(container_element, series_list, stacking_type, label_prefix) {

	Highcharts.chart(container_element, {
		chart: {
			type: 'area'
		},
		title: {
			text: 'Failure Modes by Week (per commit), ' + label_prefix
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
				text: label_prefix + ' per commit'
			},
			min: 0
		},
		tooltip: {
			useHTML: true,
			style: {
				pointerEvents: 'auto'
			},
			pointFormatter: function() {
				const commit_id_bounds = ranges_by_week[this.x]["commit_id_bound"];

				const unnormalized_val = ranges_by_week[this.x][this.series.name];

				const parms_string = $.param({
					"min_commit_index": commit_id_bounds["min_bound"],
					"max_commit_index": commit_id_bounds["max_bound"],
				});

				const link_url = "/master-timeline.html?" + parms_string;
				const content = this.y.toFixed(2) + " (" + unnormalized_val + ")<br/>" + link("(details)", link_url);
				return content;
			},
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


function render(weeks_count) {

	$("#scan-throbber").show();
	$("#scan-throbber2").show();
	$.getJSON('/api/master-weekly-failure-stats', {"weeks": weeks_count}, function (data) {

		$("#scan-throbber").hide();
		$("#scan-throbber2").hide();

		const separated_causes_series_points = {};

		const undifferentiated_build_failures_series_points = [];
		const undifferentiated_commit_failures_series_points = [];

		const commit_count_series_points = [];

		const column_chart_series = {};
		const column_chart_timestamp_categories = [];

		for (var datum of data["by_week"]) {

			const week_val = Date.parse(datum["week"]);
			const commit_count = datum["commit_count"];

			ranges_by_week[week_val] = datum;

			const weeks_ago_count = moment().diff(week_val, "weeks");
			const weeks_ago_string = weeks_ago_count + " week" + (weeks_ago_count != 1 ? "s" : "") + " ago"
			column_chart_timestamp_categories.push(weeks_ago_string);

			const aggregate_build_counts = datum["aggregate_build_counts"];

			for (var key in aggregate_build_counts) {
				if (!["failure_count"].includes(key)) {

					const normalized_value = 1.0 * aggregate_build_counts[key] / commit_count;

					const pointlist = setDefault(separated_causes_series_points, key, []);
					pointlist.push([week_val, normalized_value])


					const column_chart_pointlist = setDefault(column_chart_series, key, []);
					column_chart_pointlist.push(normalized_value)
				}
			}

			commit_count_series_points.push([week_val, commit_count]);

			undifferentiated_build_failures_series_points.push([week_val, 1.0 * aggregate_build_counts["failure_count"] / commit_count]);

			undifferentiated_commit_failures_series_points.push([week_val, 1.0 * datum["aggregate_commit_counts"]["had_failure"] / commit_count]);
		}

		const separated_causes_series_list = [];
		for (var key in separated_causes_series_points) {
			const pointlist = separated_causes_series_points[key]
			separated_causes_series_list.push({
				name: key.replace(new RegExp("_", 'g'), " "),
				data: pointlist,
				color: data["build_colors"][key],
			});
		}


		// Sort series by volume
		separated_causes_series_list.sort(function(a, b) {

			const add = (a, b) => a + b;
			const get_area = z => z.data.map(x => x[1]).reduce(add);

			// in descending order
			return get_area(b) - get_area(a);
		});

		separated_causes_timeline_highchart('container-stacked-timeline-separated-occurrences-by-week', separated_causes_series_list, 'normal', 'counts');
		separated_causes_timeline_highchart('container-percent-timeline-separated-occurrences-by-week', separated_causes_series_list, 'percent', 'percent');


		separated_causes_column_highchart(column_chart_timestamp_categories, column_chart_series, data["build_colors"]);


		const commit_count_single_series = {
			name: "Commit count",
			data: commit_count_series_points,
			yAxis: 0,
			dashStyle: 'shortdot',
		};

	        const undifferentiated_build_failures_series = [
			{
				name: "Rate of build failures per commit",
				data: undifferentiated_build_failures_series_points,
				yAxis: 1,
			},
			commit_count_single_series,
		];


	        const undifferentiated_commit_failures_series = [
			{
				name: "Failed commit rate",
				data: undifferentiated_commit_failures_series_points,
				yAxis: 1,
			},
			commit_count_single_series,
		];


		normalized_commit_failure_count_highchart(undifferentiated_commit_failures_series);
		normalized_build_failure_count_highchart(undifferentiated_build_failures_series);
	});
}

function populate_form_from_url() {

	const urlParams = new URLSearchParams(window.location.search);

	const weeks_count = urlParams.get('weeks_count');
	if (weeks_count != null) {
		$('#weeks-count-input').val(weeks_count);
	}
}


function main() {
	populate_form_from_url();

	const weeks_count = $('#weeks-count-input').val();
	render(weeks_count);
}

