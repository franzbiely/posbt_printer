import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  StatusBar,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    // Initialize BLE module
    BleManager.start({ showAlert: false });

    // Add event listeners
    const listeners = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
    ];

    // Request permissions on Android
    if (Platform.OS === 'android') {
      requestPermissions();
    }

    return () => {
      // Remove event listeners on cleanup
      listeners.forEach(listener => listener.remove());
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) { // Android 12 or higher
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

        const allGranted = results.every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'This app requires Bluetooth and Location permissions to function properly'
          );
        }
      } else { // Android 11 or lower
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to location for Bluetooth scanning.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied');
        }
      }
    }
  };

  const handleDiscoverPeripheral = peripheral => {
    if (!peripheral.name) {
      peripheral.name = 'Unknown Device';
    }
    setDevices(prevDevices => {
      const devices = [...prevDevices];
      const index = devices.findIndex(device => device.id === peripheral.id);
      if (index === -1) {
        devices.push(peripheral);
      }
      return devices;
    });
  };

  const handleStopScan = () => {
    setIsScanning(false);
    console.log('Scan stopped');
  };

  const startScan = () => {
    if (!isScanning) {
      setDevices([]);
      setIsScanning(true);
      BleManager.scan([], 5, false)
        .then(() => {
          console.log('Scanning...');
        })
        .catch(err => {
          console.error(err);
        });
    }
  };

  const sendMessage = async device => {
    try {
      // Connect to device
      await BleManager.connect(device.id);
      console.log(`Connected to ${device.name}`);

      // Get device services and characteristics
      const services = await BleManager.retrieveServices(device.id);
      console.log('Available Services:', services);

      // Log all services and their characteristics
      services.services.forEach(serviceUUID => {
        console.log(`\nService: ${serviceUUID}`);
        const characteristics = services.characteristics[serviceUUID];
        if (characteristics) {
          characteristics.forEach(characteristic => {
            console.log(`  Characteristic: ${characteristic.characteristic}`);
            console.log(`  Properties: ${JSON.stringify(characteristic.properties)}`);
          });
        }
      });

      // Look for a writable characteristic
      let foundService = null;
      let foundCharacteristic = null;

      for (const serviceUUID of services.services) {
        const characteristics = services.characteristics[serviceUUID];
        if (characteristics) {
          const writableCharacteristic = characteristics.find(
            char => char.properties.Write || char.properties.WriteWithoutResponse
          );
          if (writableCharacteristic) {
            foundService = serviceUUID;
            foundCharacteristic = writableCharacteristic.characteristic;
            break;
          }
        }
      }

      if (foundService && foundCharacteristic) {
        // Convert string to bytes
        const message = 'Hello World';
        const bytes = Array.from(message).map(char => char.charCodeAt(0));

        // Write the message
        await BleManager.write(
          device.id,
          foundService,
          foundCharacteristic,
          bytes
        );

        console.log('Message sent successfully');
        Alert.alert('Success', 'Message sent successfully');
      } else {
        throw new Error('No writable characteristic found');
      }

      // Disconnect from device
      await BleManager.disconnect(device.id);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to send message');
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => sendMessage(item)}>
      <Text style={styles.deviceName}>{item.name}</Text>
      <Text style={styles.deviceInfo}>RSSI: {item.rssi}</Text>
      <Text style={styles.deviceInfo}>ID: {item.id}</Text>
    </TouchableOpacity>
  );

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
            data={devices}
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