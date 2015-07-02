// WISH LIST/TO DO-----------------------------------------------|
//getting closer!
//menus need to update after filter apply
//remove filter not work
//i have not mapped the date  filters  at all!
//slowly migrating to a list of object for the filters rather than an array of names...some functions may be need to beupdated wherever you see "filterList"
//use dev version of leaflet (.8) so taht you can add marker properties (see: 	http://stackoverflow.com/questions/17423261/how-to-pass-data-with-marker-in-leaflet-js
//create filter DOMs programmitcaly from filter list? that would be cool.
//and why not use dictionaries instead of arrays for the filters?
//1. fix date filter
//2. remove duplicate officer names
//3. errors out if no results returned
//don't load any features until filter applied?
//count display not working
//show 'loading data...' screen when filter is applied
//perfomance issue: check to see if filter has changed before going through the whole apply thing...
//performance issue: store master json and uniques in memory and access when filter is removed?
//fix 'primary reported violation' type
//mulitiple cases at same address
//how to handle unplace points
//build in check for updates//only update new or updated cases
//add panel pop-up for case events and statistics
//fix drop down menu duplicates
//cleanup code
//pop-up marker link to directions (FROM CURRENT LOCATION!)
//add a table view tab and/or download
// layers for council and jurisdiction
//auto-complete for case number
//add view for cases with invalid addresses
// different color by safety
// customizeable filter lists (drop down for filter type and value)
//backend: query feature service based on filter

//globals------------------------------------------------------------|
var	inspectorList = [], caseList = [], locationList = [], violationList = [];

		
var	activeFilters = [];  //an array of all filters that are currently applied

var filterList = [
				{"filterName":"Officer","fieldName":"case_manager", "filterStyle": "dropDown", "uniqueValues": inspectorList, "filterType": "text"},
				{"filterName":"Case #","fieldName":"case_id", "filterStyle": "searchBox","uniqueValues": caseList,"filterType": "text"}, 
				{"filterName":"Location","fieldName":"address", "filterStyle": "searcBox","uniqueValues": locationList,"filterType": "text"},
				{"filterName":"Violation Type","fieldName":"description", "filterStyle": "dropDown","uniqueValues": violationList,"filterType": "text"}]

var	data,
		compareValue,
		selection,
		amandaService,
		makers,
		amandaFeatures,
		districtLayer,
		map,
		OSMBase,
		mapQuest,
		Esri_WorldImagery,
		baseMaps,
		infoLayers,
		featureCount,
		tempJson; //can you avoid any of these globals?

var filteredData = [];

var  applyRemove = 2; //on initial load, point the filters to the baseline data set (applyRemove = 2)

var codeDistrictLayerStyle = {
    "color": "black",
	"fill": true,
	"opacity": 0.9,
    "weight": 4
};

//------date filter and autocomplete----------------------------------|
	
//add datepicker with today's date as placeholder text
$(function() {
	$( ".datepicker" ).datepicker();
});

$(function(){
	var today = new Date();
	var day = today.getDate();
	var month = today.getMonth() + 1;
	var year = today.getFullYear();
	var dateString = month + "/" + day + "/" + year;
	$(".datepicker").attr('placeholder', dateString)
})

//Retrieve JSON Data--------------------------------------------------|
//-----------------------------------------------------------------------|

var districtLines = (function () {
    var districtLines = null;
    $.ajax({
        'async': false,
        'global': false,
        'url': 'CodeDistricts_2pctSimp.json',
        'dataType': "json",
        'success': function (data) {
            districtLines = data;
        }
    });
    return districtLines;
})(); 

//-------make the map------------------------------------------------|
initializeMap();

//-------event listeners-----------------------------------------------|
//center map on clicked marker
map.on('popupopen', function(centerMarker) { 
        var cM = map.project(centerMarker.popup._latlng);
        cM.y -= centerMarker.popup._container.clientHeight/2
        map.panTo(map.unproject(cM), {animate: true});
    });

//apply filters
$("#applyFilterButton").click(function(){
	applyRemove = 1;
	displayLoader(1);
}); //end filter button function

//remove filters
$("#removeFilterButton").click(function(){
	applyRemove = 2;
	displayLoader(2);
}); //end filter button function


$(".filter").change(function(){ //change filter color when option changes
		if ($(this).val()=="") {
			$(this).css("background-color", "");
		} else {
			$(this).css("background-color", "#CC8080");
		}
});

//---------------------------------------------------------------------|

function activateAutocomplete() {
	$(function() {
		$( "#case_id" ).autocomplete({ source: filterList[1]["uniqueValues"] })
	})
}

function retrieveFeatures() {
	(function () {
		var districtLines = null;
		$.ajax({
			'async': false,
			'global': false,
			'url': 'https://data.austintexas.gov/resource/6wtj-zbtb.json?$where=closed_date IS NULL&$limit=10000',
			'dataType': "json",
			'success': function (d) {
				data = d;
			}
		});
		loadMapData();
	})(); 
}//end retrieveFeatures

function loadMapData(){  //runs once when map loads
	sideBar();
	initializeLayers();
	createMarkerLayer(data);
	addLayerControls();
	getUniques(data); //GET UNIQUE JSON VALUES...
	removeLoader();
}

function displayLoader(value){
	$("#loader").fadeIn("slow", function(){
		if (value == 1) {
			removeHighlights();
			updateFilters();
			applyFilters();
		}
		if (value ==2) {
			removeFilters();
		}
	}); //remove loading screen
	
}//end display loader

function removeLoader(){
	$("#loader").fadeOut("slow", function(){
		if (applyRemove == 1) {
			showResults(filteredData); //Display number of features in results area
		}	else { showResults(data); //Display number of features in results area
		}
	}); //remove loading screen
	
}//end remove loader

function initializeMap() {
	console.log("Initialize map");
	
	OSMBase = new L.TileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
		attribution: '<a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	
	MapQuestOpen_OSM = new L.tileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg', {
		attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/">MapQuest</a> - Map data: <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		subdomains: '1234'
	});
	
	Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
	});

	map = new L.Map("map", {center: [30.268332, -97.738295], zoom: 11, minZoom: 1, maxZoom: 18, layers: [OSMBase]})
	map.on('load', retrieveFeatures());  //
}

function sideBar(){
	console.log("Add sidebar");
	//Sidebar
	var sidebar = L.control.sidebar('sidebar').addTo(map);							
	//delay sidebar open
	setTimeout(function () {
	   sidebar.open("home");
	}, 500);
}

function initializeLayers() {
	L.Icon.Default.imagePath = './images';
	districtLayer = L.geoJson(districtLines, {
									style: codeDistrictLayerStyle,
									onEachFeature: function (feature, layer) {
										layer.bindLabel("<b>" + feature.properties.DISTRICT + "</b>", { noHide: true });
									}
	});

}  //end initializeLayers

function createMarkerLayer(jsonObj){
	markers = new L.MarkerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true});
	for (var i = 0; i < jsonObj.length; i++) {
		if (jsonObj[i].latitude) {
			var lat = jsonObj[i].latitude;
			var lon = jsonObj[i].longitude;
			var caseId = jsonObj[i].case_id;
			var house_number = jsonObj[i].house_number;
			var street_name = jsonObj[i].street_name;
			var officer = jsonObj[i].case_manager;
			var violation = jsonObj[i].description;
			var popup = "<div style='font-size: larger'><b>" + house_number + street_name + "</b></div><b> Case #: </b>" + caseId + "</br><b>Inspector: </b>" + officer +  "</br><b> Violation: </b>" + violation + "</br></br><img src='https://maps.googleapis.com/maps/api/streetview?size=250x250&location=" + lat + "," + lon + "'/>"
			var marker = new L.marker([lat, lon]).bindPopup(popup);
		}
		markers.addLayer(marker);
		if (i==jsonObj.length-1) {
			drawLayers(markers);
		};
	};
} //end createMarkerLayer

function drawLayers(layer){
	layer.addTo(map) //show complaint locations by default
}

function addLayerControls(){
	//layer control data
	infoLayers = {
		"Complaint Locations": markers,
		"Code Districts": districtLayer
	};
	baseMaps = {
		"MapQuest": MapQuestOpen_OSM,
		"Bright": OSMBase,
		"Satellite": Esri_WorldImagery
	};
	//add layers and control to map
	controlLayers = L.control.layers(baseMaps, infoLayers);
	controlLayers.addTo(map);
}//end addLayerControls

function updateFilters() {  //add 'activated' filters to activeFilters
	for (var i = 0; i < filterList.length; i++) { //for every filter 
		var filterId = filterList[i]["fieldName"];
		var filterValue = $("#" + filterId).val()  //get filter type and value for the filter
		var dateSelctionType = "";
		//you need to check to make sure that the filter type//value is not in active filter before you push it!<<<<<<<BUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUG
		if (filterValue != "") { //if the filter value is not empty (it's active)
			if (filterList[i]["filterType"] == "date") { //if the filter is a date filter
				filterList[i]["filterValue"] = new Date(filterValue).getTime(); //convert m/d/yyyy to epoch format
				dateSelctionType = $("#" + filterList[i]["fieldName"] + "_Before_After").val(); //get the before or after setting
				filterList[i]["dateSelctionType"] = dateSelctionType;
			} else {
				filterList[i]["filterValue"] = filterValue; //add the filter value that the user has selected into the filter list as the filterValue
			}
			activeFilters.push(filterList[i]); //send filter object to the global active filter array
		} else {  //check to see if an active filter has been changed to null
			for (var q = 0; q < activeFilters.length; q++) { //for all the active filters
				if (activeFilters[q]["fieldName"].indexOf(filterId) >= 0) { //if the filter is on the active filter, it should be removed
					activeFilters.splice(q, 1); //remove it!
					break;
				};
			};
		};
	};
	highlightFilters();
} //end update Filters

function applyFilters() {
	//refresh vars
	filteredData = [];
	map.removeLayer(markers); //remove 'old' version of layer and refresh layers
	markers = new L.MarkerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true});
	filterAmandaFeatures(data)
} //end applyFilters 

function removeFilters() {
	map.removeLayer(markers); //remove 'old' version of layer
	$('.search-box').val("")  //clear the search box values
	$('select').prop("selectedIndex",0) //set all select menus to the first option in the drop-down  ///<<<made redundant by updateMenus() ?
	activeFilters = []  //reset list of activeFilters - charts tab is based on this data
	//insert function to draw layer
	updateLayerControls();  //refresh layer controls
	removeHighlights();
	removeLoader();
} //end removeFilters

function filterAmandaFeatures(jsonObj){
	//see old version, fix!
	for (var i = 0; i < data.length; i++){ //for every feature
		var keepTruckin = false;
		for (var q = 0; q < activeFilters.length; q++) { //for every filter in the apply filter array
			var currentFilterType = activeFilters[q]["fieldName"];
			var currentFilterValue = activeFilters[q]["filterValue"]; //the value of the filter selection
			var featureValue = data[i][currentFilterType];
			//if (typeof(currentFilterValue) == "string") {
						//currentFilterValue = currentFilterValue.toUpperCase();  //this allows non-case sensitive search for text inputs....could add a conditional to only do this if the filter's class = search-box....
			//}
			if (featureValue != null) { //if the featureValue is not null
				//if it is a date...do this
				if (activeFilters[q]["filterType"] == "date") { //if the filter is a date filter
					if (activeFilters[q]["dateSelctionType"] == "after") { //if the selector is set to after
						if (featureValue > currentFilterValue){ //if the current feature value is larger (i.e. more recent) than the filter value
							keepTruckin = true; //keep truckin'
						}
						else {
							keepTruckin = false;
							break;
						}
					}
					else {
						if (activeFilters[q]["dateSelctionType"] == "before") { //if the selector is set to before
							if (featureValue < currentFilterValue){ //if the current feature value is larger (i.e. more recent) than the filter value
								keepTruckin = true; //keep truckin'
							} else {
								keepTruckin = false;
								break;
							}
						}
					}
				}
				// otherwise if the feature value is not a number
				else if (isNaN(featureValue) == true) {
					if (featureValue.indexOf(currentFilterValue) >= 0) { //if the filterValue is in the featureValue (this means partial search included)
						
						keepTruckin = true;
					}
					else { //if filterValue is not in the FeatureValue, don't keep truckin and break out of loop
						keepTruckin = false;
						break;
					}
				}
				else if (isNaN(featureValue) == false) { //if the feature value is a number
					if (featureValue == currentFilterValue) {//if the feature and filter values are the same
						keepTruckin = true;
					}
					else {
						keepTruckin = false;
						break;
					}
				}
				else { //if featureValue is null, don't keep truckin and break out of loop
					keepTruckin = false;
					break; 
				}
			}
		} //end filter for
		if (keepTruckin == true) { //create feature, add to marker, and add to currentData object
			filteredData.push(data[i])
		}
	} //end data iteration
	createMarkerLayer(filteredData);
	zoomToExtent();
}  //end filterAmandaFeatures

function updateLayerControls(){
	//remove 'old' layer controls
	controlLayers.removeFrom(map);  
	// update layer controls and add to map
	infoLayers = {
		"Complaint Locations": markers,
		"Code Districts": districtLayer
	};
	controlLayers = L.control.layers(baseMaps, infoLayers);
	controlLayers.addTo(map);
	if (applyRemove == 1) {
		getUniques(filteredData); //read new subset of features and update menus
	} else {
		getUniques(data) //read the original feature data and update menus
	}
}//end updateControlLayers

function zoomToExtent() {
	var bounds = markers.getBounds();
	map.fitBounds(bounds)
	removeLoader();
}//end zoomToExtent

function getUniques(jsonObj){ //get uniqe values from JSON to generate drop-down menus // happens once at page load
	console.log("Get unique values from JSON");
	for (var q = 0; q < filterList.length; q++){ //for every kind of filter 
		//reset contents of unique value lists
		filterList[q]["uniqueValues"] = [];
		var flags = [], l = data.length, i;
		for( i=0; i<l; i++) {
			if( flags[data[i][filterList[q]["fieldName"]]]) continue;
			flags[data[i][filterList[q]["fieldName"]]] = true;
			filterList[q]["uniqueValues"].push(data[i][filterList[q]["fieldName"]]);
		}
		filterList[q]["uniqueValues"].sort(); //after all values have been added to that filter array, sort it.
	}
	updateMenus();
	activateAutocomplete(); //once all the uniques have been captured, you can run the autocomplete function
} //end getUnqiues function

function updateMenus() {
	for (var q = 0; q < filterList.length; q++){ //for every kind of filter 
		var list = $("#" + filterList[q]["fieldName"]); //select that filter's select menu
		list.find('option').remove().end() //remove any already-existing menu opt
		list.append($("<option></option>").attr("value", "").text(filterList[q]["filterName"]));  //add menu option title as topmost option
		
		$.each(filterList[q]["uniqueValues"], function(index, value) {  //and add all the unique options from the filters object
			list.append($("<option></option>").attr("value", value).text(value));
		});
		
		for (var z = 0; z < activeFilters.length; z++) { //for all of the active filters
			if (activeFilters[z].indexOf(filterList[q]["fieldName"]) >= 0) { //if the current filter menu is on the active filter list
				list.prop("selectedIndex",1)  //set the current selected option as the second (i.e., the only not-default option on the list)
			};
		};		
	};
	//change 'Type' filter menu text from abbreviations to names
	$("#Type").find("option") //select Type filter and all options, follow logic to replace option text
		.text(function() {
			var currentText = $(this).text()
			if (currentText === "M") {
				currentText = "Multifamily"
			}
			else if (currentText === "C") {
				currentText = "Commercial"
			}
			else if (currentText === "N") {
				currentText = "Neighborhood"
			}
			return currentText;
		});//end text function	
		
} //end update menus

function showResults(jsonObj){
	console.log("showResults")
	$(".results").text("");
	var count = 0;
	for (var thing in jsonObj) {   //count features in layer
			count = count + 1;
	}
	$(".results").text(count + " CASES FOUND")
	if (count == 0) {
		$(".results").effect("shake")
	}
}//end showResults

function highlightFilters() {  //select all active filters and change background color
	for (var i = 0; i < activeFilters.length; i++) {
		filterId = activeFilters[i][0]
		$('#' + filterId).css("background-color", "#990000")
	}
} //end highlightFilters

function removeHighlights() { //select all filters and restore default background color
	$(".filter").css("background-color", "")
}
