import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkDrivers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const sellerId = '695b7d5ea0b51822cd33332b';
        const seller = await Seller.findById(sellerId);

        if (!seller || !seller.location) {
            console.error('Seller not found or has no location');
            process.exit(1);
        }

        const [lng, lat] = seller.location.coordinates;
        const radiusKm = seller.serviceRadiusKm || 10;
        const radiusMeters = radiusKm * 1000;

        console.log(`\n🏪 Seller: ${seller.storeName}`);
        console.log(`📍 Location: [${lng}, ${lat}]`);
        console.log(`📏 Service Radius: ${radiusKm} km (${radiusMeters}m)\n`);

        let drivers;
        try {
            drivers = await Delivery.find({
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [lng, lat]
                        },
                        $maxDistance: radiusMeters
                    }
                }
            });
            console.log(`✅ GeoQuery found ${drivers.length} drivers.`);
        } catch (geoError: any) {
            console.warn(`⚠️ GeoQuery failed: ${geoError.message}. Falling back to manual distance calculation.`);
            const allDrivers = await Delivery.find({});
            drivers = allDrivers.filter(d => {
                if (!d.location || !d.location.coordinates) return false;
                const [dlng, dlat] = d.location.coordinates;
                const dist = getDistance(lat, lng, dlat, dlng);
                return dist <= radiusKm;
            });
            console.log(`✅ Manual fallback found ${drivers.length} drivers within ${radiusKm}km.`);
        }

        for (const driver of drivers) {
            const dLng = driver.location?.coordinates[0];
            const dLat = driver.location?.coordinates[1];
            const dist = getDistance(lat, lng, dLat || 0, dLng || 0);

            console.log(`   - ${driver.name} | ID: ${driver._id}`);
            console.log(`     Status: ${driver.status} | Online: ${driver.isOnline}`);
            console.log(`     Distance: ${dist.toFixed(2)} km`);
            console.log(`     Location: [${dLng}, ${dLat}]`);
            console.log(`-------------------------------------------`);
        }

        const onlineDrivers = drivers.filter(d => d.isOnline && d.status === 'Active');
        console.log(`\n🚀 DRIVERS WHO WOULD BE NOTIFIED (Online & Active within radius): ${onlineDrivers.length}`);
        onlineDrivers.forEach(d => console.log(`   - ${d.name} (${d._id})`));

        // Let's also check if Vishal is online at all
        const vishalId = '694550f670edfa22e003c6a1';
        const vishal = await Delivery.findById(vishalId);
        if (vishal) {
            console.log(`\n🔍 Checking Vishal Patel specifically:`);
            console.log(`   ID: ${vishal._id}`);
            console.log(`   Online: ${vishal.isOnline}`);
            console.log(`   Status: ${vishal.status}`);
            console.log(`   Location: [${vishal.location?.coordinates}]`);
            if (vishal.location) {
                const vDist = getDistance(lat, lng, vishal.location.coordinates[1], vishal.location.coordinates[0]);
                console.log(`   Distance to Seller: ${vDist.toFixed(2)} km`);
                console.log(`   Within Radius: ${vDist <= radiusKm}`);
            }
        } else {
            console.log(`\n❌ Driver with ID ${vishalId} not found in database.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

checkDrivers();
