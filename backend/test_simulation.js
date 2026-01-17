
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected to server');
    
    // Simulate replication progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress > 100) {
            clearInterval(interval);
            socket.emit('test:replication:complete', { success: true });
            console.log('Simulation complete');
            process.exit(0);
        } else {
            console.log(`Emitting progress: ${progress}%`);
            // Note: In a real scenario, the server emits this. 
            // Since we can't easily trigger the server to emit this without starting a real replication,
            // we are just testing if WE can connect. 
            // Actually, to test the frontend, we need the SERVER to emit this.
            // Sending it from client to server won't help unless the server relays it or we are the server.
            // This script is effectively useless for testing the frontend unless we modify the server to relay.
        }
    }, 1000);
});
