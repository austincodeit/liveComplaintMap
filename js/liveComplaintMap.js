// WISH LIST/TO DO-----------------------------------------------|
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
var 	districtList = [],
		zoneList = [],
		inspectorList = [],
		statusList = [],
		violationList = []
		priorityList = [],
		caseList = [],
		locationList = [],
		dateUpdated = [],
		openDate = [];
var featureProperties = {};
featureProperties["features"] = [];   //skeleton for filter feature data
		
var	filterList = ["District","Type","Officer","Status","Primary_Reported_Violation", "Priority", "Case_Number", "Location", "Date_Updated", "Open_Date"], //strings much match JSON feature properties keys and filter ID
		filterArray = [districtList, zoneList, inspectorList, statusList, violationList, priorityList, caseList, locationList, dateUpdated, openDate], //should replicate the order of filterList array 
		activeFilters = [];  //an array of all filters that are currently applied

var	compareValue,
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

var  applyRemove = 2; //on initial load, point the filters to the baseline data set (applyRemove = 2)

var json = {
		"type": "FeatureCollection",
		"features": []
	}

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
		$( "#Case_Number" ).autocomplete({ source: filterArray[6] })
	})
}

function retrieveFeatures() {
	var url = "http://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/amandaComplaintFeatures6/FeatureServer/0/"
	console.log("retrieveFeatures from AGOL");
	amandaService = L.esri.Services.featureLayer(url) //instantiate service
	amandaService.query().run(function(error, featureCollection){
		featureCount = featureCollection.features.length;
		json = featureCollection
		loadMapData();
	});
}//end retrieveFeatures

function loadMapData(){  //runs once when map loads
	sideBar();
	initializeLayers();
	drawLayers();
	addLayerControls();
	getUniques(json); //GET UNIQUE JSON VALUES...
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
			showResults(amandaFeatures); //Display number of features in results area
		}	else { showResults(baselineAmandaFeatures); //Display number of features in results area
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
	districtLayer = L.geoJson(districtLines, {
									style: codeDistrictLayerStyle,
									onEachFeature: function (feature, layer) {
										layer.bindLabel("<b>" + feature.properties.DISTRICT + "</b>", { noHide: true });
									}
	});
	baselineAmandaFeatures = L.geoJson(json, {
								onEachFeature: function (feature, layer) {
									lon = String(feature.geometry.coordinates[0])  //grab the geometry, not the property, which has a variable spatial reference
									lon = lon.substring(0,9)
									lat = String(feature.geometry.coordinates[1]) 
									lat = lat.substring(0,8)
									layer.bindPopup("<div style='font-size: larger'><b>" + feature.properties.Location + "</b></div><b> Case #: </b>" + feature.properties.Case_Number + "</br><b> District: </b>" + feature.properties.District + "</br> <b>Inspector: </b>" + feature.properties.Officer +  "</br><b> Violation: </b>" + feature.properties.Primary_Reported_Violation + "</br></br><img src='https://maps.googleapis.com/maps/api/streetview?size=250x250&location=" + lat + "," + lon + "'/>");
									
									layer.bindLabel("<b>" + feature.properties.Location + "</b>");
								}
	});
	//Create marker cluster layer
	markers = L.markerClusterGroup();
	markers = new L.MarkerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true});
}  //end initializeLayers

function drawLayers(){
	markers.addLayer(baselineAmandaFeatures);
	markers.addTo(map) //show complaint locations by default
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
		var currentFilter = []
		var filterType = filterList[i];
		var filterValue = $("#" + filterType).val()  //get filter type and value for the filter
		var dateSelctionType = "";
		//you need to check to make sure that the filter type//value is not in active filter before you push it!<<<<<<<BUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUGBUG
		if (filterValue != "") { //if the filter value is not empty (it's active)
			if (filterList[i] == "Open_Date" || filterList[i] == "Date_Updated") { //if the filter is a date filter
				filterValue = new Date(filterValue).getTime(); //convert m/d/yyyy to epoch format
				dateSelctionType = $("#" + filterList[i] + "_Before_After").val(); //get the before or after setting
			}
			currentFilter.push(filterType);  //add filter ID and value to temp array
			currentFilter.push(filterValue);
			if (dateSelctionType) {
				currentFilter.push(dateSelctionType); //add before or after setting to filter array if it exists
			}
			activeFilters.push(currentFilter); //send filter ID and value as array to global active filter array
		} else {  //check to see if an active filter has been changed to null
			for (var q = 0; q < activeFilters.length; q++) {	
				if (activeFilters[q].indexOf(filterType) >= 0) {
					activeFilters.splice(q, 1);
					break;
				};
			};
		};
	};
	highlightFilters();
} //end update Filters

function applyFilters() {
	//refresh vars
	featureProperties.features = []; //clear featureProperties
	map.removeLayer(markers); //remove 'old' version of layer and refresh layers
	markers = new L.MarkerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true});
	createAmandaFeatures(json)
} //end applyFilters 

function removeFilters() {
	map.removeLayer(markers); //remove 'old' version of layer
	$('.search-box').val("")  //clear the search box values
	$('select').prop("selectedIndex",0) //set all select menus to the first option in the drop-down  ///<<<made redundant by updateMenus() ?
	activeFilters = []  //reset list of activeFilters - charts tab is based on this data
	markers.addLayer(baselineAmandaFeatures); //add new layer to marker layer
	markers.addTo(map);	//add marker layer to map
	updateLayerControls();  //refresh layer controls
	removeHighlights();	
} //end removeFilters

function createAmandaFeatures(jsonObj){
	amandaFeatures = L.geoJson(jsonObj, {
			filter: function(feature, layer) {
				var keepTruckin = true;
				for (var i = 0; i < activeFilters.length; i++) { //for every filter in the apply filter array
					var currentFilterValue = activeFilters[i][1] //the value of the filter selection
					var featureValue = feature.properties[activeFilters[i][0]]; //the feature's property value against which to check the filter
					if (typeof(currentFilterValue) == "string") {
						currentFilterValue = currentFilterValue.toUpperCase();  //this allows non-case sensitive search for text inputs....could add a conditional to only do this if the filter's class = search-box....
					}
					if (typeof(featureValue) == "string") {
						featureValue = featureValue.toUpperCase();
					}
					if (featureValue != null) { //if the featureValue is not null
						
						//if it is a date...do this
						if (activeFilters[i][0] == "Open_Date" || activeFilters[i][0] == "Date_Updated") { //if the filter is a date filter
							if (activeFilters[i][2] == "after") { //if the selector is set to after
								if (featureValue > currentFilterValue){ //if the current feature value is larger (i.e. more recent) than the filter value
									keepTruckin = true; //keep truckin'
								}
								else {
									keepTruckin = false;
									break;
								}
							}
							else {
								if (activeFilters[i][2] == "before") { //if the selector is set to after
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
				}//end apply filter for statement
				if (keepTruckin == true) {
						featureProperties.features.push(feature);	
						return true; //if  the feature makes it here, the feature meets all filter criteria, so include it
				} else { return false; }
			},//end filter
			onEachFeature: function (feature, layer) { //generate popups and labels
				//get latLon for google streetview
				lon = String(feature.geometry.coordinates[0])  //grab the geometry, not the property, which has a variable spatial reference
				lon = lon.substring(0,9)
				lat = String(feature.geometry.coordinates[1]) 
				lat = lat.substring(0,8)
				//generate popup
				layer.bindPopup("<div style='font-size: larger'><b>" + feature.properties.Location + "</b></div><b> Case #: </b>" + feature.properties.Case_Number + "</br><b> District: </b>" + feature.properties.District + "</br> <b>Inspector: </b>" + feature.properties.Officer +  "</br><b> Violation: </b>" + feature.properties.Primary_Reported_Violation + "</br></br><img src='https://maps.googleapis.com/maps/api/streetview?size=250x250&location=" + lat + "," + lon + "'/>");
				//generate label
				layer.bindLabel("<b>" + feature.properties.Location + "</b>");
			}
	}); //end amandaFeatures
	markers.addLayer(amandaFeatures); //add new layer to marker layer
	markers.addTo(map);	//add marker layer to map
	updateLayerControls();
}  //end createAmandaFeatures

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
		getUniques(featureProperties); //read new subset of features and update menus
	} else {
		getUniques(json) //read the original feature data and update menus
	}
}//end updateControlLayers

function zoomToExtent() {
	var bounds = markers.getBounds();
	map.fitBounds(bounds)
	removeLoader();
}//end zoomToExtent

function getUniques(jsonObj){ //get uniqe values from JSON to generate drop-down menus // happens once at page load
	//reset contents of unique value lists
	districtList = [];
	zoneList = [];
	inspectorList = [];
	statusList = [];
	violationList = [];
	priorityList = [];
	caseList = [];
	locationList = [],
	dateUpdated = [],
	openDate = [];

	filterArray = [districtList, zoneList, inspectorList, statusList, violationList, priorityList, caseList, locationList, dateUpdated, openDate]; //reset array subsets ...this is for dynamic menu updating
	
	console.log("Get unique values from JSON");
	for (var i = 0; i < jsonObj.features.length; i++) {  //for every single feature
		for (var q = 0; q < filterList.length; q++){ //for every kind of filter 
			var checkValue = jsonObj.features[i].properties[filterList[q]] //get the value for that filter from the json data
			if (checkValue) {  //if checkValue is not null
				if ($.inArray(checkValue, filterArray[q]) < 0) { //check if the value exists in the corresponding filter array
					filterArray[q].push(checkValue); //and add it if it doesn't exist
				}
			}
			filterArray[q].sort(); //after all values have been added to that filter array, sort it.
		}
	}
	updateMenus();
	activateAutocomplete(); //once all the uniques have been populated to the filterArray, you can run the autocomplete function
} //end getUnqiues function

function updateMenus() {
	for (var q = 0; q < filterList.length; q++){ //for every kind of filter 
		var list = $("#" + filterList[q]); //select that filter's select menu
		list.find('option').remove().end() //remove any already-existing menu opt
		list.append($("<option></option>").attr("value", "").text(filterList[q]));  //add menu option title as topmost option
		
		$.each(filterArray[q], function(index, value) {  //and add all the unique options from the filterArray
			list.append($("<option></option>").attr("value", value).text(value));
		});
		
		for (var z = 0; z < activeFilters.length; z++) { //for all of the active filters
			if (activeFilters[z].indexOf(filterList[q]) >= 0) { //if the current filter menu is on the active filter list
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
		zoomToExtent();
} //end update menus

function showResults(layer){
	console.log("showResults")
	$(".results").text("");
	var count = 0;
	for (var thing in layer._layers) {   //count features in layer
			count = count + 1;
	}
	$(".results").text(count + " CASES FOUND")
	if (count == 0) {
		$(".results").effect("shake")
	}
}//end showResults

function highlightFilters() {  //select all active filters and change background color
	for (var i = 0; i < activeFilters.length; i++) {
		filter = activeFilters[i][0]
		$('#' + filter).css("background-color", "#990000")
	}
} //end highlightFilters

function removeHighlights() { //select all filters and restore default background color
	$(".filter").css("background-color", "")
}

//for debugging missing features issue...
//var list = [], badList = [];
//for (thing in json.features) { var checkId = json.features[thing].properties.CustomId; if (list.indexOf(checkId) < 0) { list.push(checkId);} else { badList.push(checkId)};}
// b = 0; for (thing in json.features) { if (json.features[thing].properties.CustomId == 2959) { console.log(b);} b = b+1}
//amandaService.query().where("CustomId >=1025" + " AND CustomId < 1050").run(function(error, featureCollection, response){ tempJson = featureCollection.features; });
