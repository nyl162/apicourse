const range = require('express-range')
const compression = require('compression')

const express = require('express')

const CitiesDB = require('./citiesdb');

//Load application keys
//Rename _keys.json file to keys.json
const keys = require('./keys.json')

console.info(`Using ${keys.mongo}`);

const db = CitiesDB({  
	connectionUrl: keys.mongo, 
	databaseName: 'zips', 
	collectionName: 'city'
});

const app = express();

app.set('etag',false)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Start of workshop

// Mandatory workshop
// TODO GET /api/states
app.get('/api/states',(req,res)=>{
	res.type('application/json');
	db.findAllStates().then(result=>{
		res.set('X-Date',(new Date()).toISOString())
		res.status(200).json(result);
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})




// TODO GET /api/state/:state
app.get('/api/state/:state',(req,res)=>{
	const state = req.params.state

	res.type('application/json');
	db.findAllStates().then(result=>{
		if(result.indexOf(state.toUpperCase()) < 0 ){
			res.status(400).json({error: `Not a valid state: ${state}`});
		}
		return db.findCitiesByState(state/*, {offset:0 , limit:10}*/ )
	}).then(result=>{
		res.status(200).json(result.map(val=>`/api/city/${val}`));
	}).catch(err=>{
		res.status(400).json({error:err});
	})
})

// TODO GET /api/city/:cityId
app.get('/api/city/:cityId',(req,res)=>{
	const city_id = req.params.cityId

	console.log(city_id)

	res.type('application/json');
	db.findCityById(city_id).then(result=>{
		res.status(200).json(result);
	}).catch(err=>{
		res.status(404).json({error:err});
	})
})

// TODO POST /api/city
app.post('/api/city',(req,res)=>{
	const cityParams = db.form2json(req.body)
	//console.log(req.body,cityParams)
	
	res.type('application/json');
	db.insertCity(cityParams).then(result=>{
		res.status(201).json(result)
	}).catch(err=>{
		res.status(400).json({error:err});
	})
	//res.status(200).json(cityParams);
})



// Optional workshop
// TODO HEAD /api/state/:state



// TODO GET /state/:state/count



// TODO GET /city/:name



// End of workshop

db.getDB()
	.then((db) => {
		const PORT = parseInt(process.argv[2] || process.env.APP_PORT) || 3000;

		console.info('Connected to MongoDB. Starting application');
		app.listen(PORT, () => {
			console.info(`Application started on port ${PORT} at ${new Date()}`);
		});
	})
	.catch(error => {
		console.error('Cannot connect to mongo: ', error);
		process.exit(1);
	});
