import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  StatusBar,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState(new Map());

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        console.log('Bluetooth is powered on');
      }
    }, true);

    return () => {
      subscription.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const results = await Promise.all(
          permissions.map(permission =>
            PermissionsAndroid.request(permission, {
              title: 'Bluetooth Permissions',
              message: 'This app needs access to Bluetooth and Location.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            })
          )
        );

        return results.every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }
    return true;
  };

  const startScan = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permissions Required', 'Please grant the required permissions');
      return;
    }

    if (!isScanning) {
      setDevices(new Map());
      setIsScanning(true);

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          setIsScanning(false);
          return;
        }

        if (device) {
          setDevices(prevDevices => {
            const newDevices = new Map(prevDevices);
            newDevices.set(device.id, device);
            return newDevices;
          });
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        setIsScanning(false);
      }, 10000);
    }
  };

  const sendMessage = async (device) => {
    try {
      console.log('Connecting to device:', device.name);
      const connectedDevice = await device.connect();
      console.log('Connected, discovering services and characteristics...');
      
      const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
      const services = await discoveredDevice.services();
      
      console.log('Services:', services);
      
      for (const service of services) {
        console.log('Service UUID:', service.uuid);
        const characteristics = await service.characteristics();
        
        for (const characteristic of characteristics) {
          console.log('Characteristic UUID:', characteristic.uuid);
          console.log('Properties:', characteristic.properties);
          
          if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
            console.log('Found writable characteristic:', characteristic.uuid);
            
            // Convert string to base64
            const message = Buffer.from('Hello World').toString('base64');
            
            await discoveredDevice.writeCharacteristicWithResponse(
              service.uuid,
              characteristic.uuid,
              message
            );
            
            console.log('Message sent successfully');
            Alert.alert('Success', 'Message sent successfully');
            break;
          }
        }
      }
      
      await discoveredDevice.cancelConnection();
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => sendMessage(item)}>
      <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
      <Text style={styles.deviceInfo}>RSSI: {item.rssi}</Text>
      <Text style={styles.deviceInfo}>ID: {item.id}</Text>
    </TouchableOpacity>
  );

  const deviceArray = Array.from(devices.values());

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <View style={styles.body}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={startScan}
            disabled={isScanning}>
            <Text style={styles.scanButtonText}>
              {isScanning ? 'Scanning...' : 'Scan Bluetooth Devices'}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={deviceArray}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.deviceList}
          />
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  scanButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  scanButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceList: {
    paddingBottom: 16,
  },
  deviceItem: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deviceInfo: {
    fontSize: 14,
    color: '#666',
  },
});

export default App; 