import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet,TouchableOpacity } from 'react-native';
import EightSleep from './src/EightSleep';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

const email = process.env.EIGHTSLEEP_EMAIL;
const pword = process.env.EIGHTSLEEP_PWORD;
const c_id = process.env.EIGHTSLEEP_C_ID;
const c_secret = process.env.EIGHTSLEEP_C_SECRET;
const userId = process.env.EIGHTSLEEP_USER_ID;

export default function App() {
  
  const [instance, setInstance] = useState(null);
  const [coolingTime, setCoolingTime] = useState(40);
  const [standby, setStandby] = useState(30);
  const [level, setLevel] = useState(1);
  const [outputMessage, setOutputMessage] = useState('');
  const [firstLoop, setFirstLoop] = useState(true);

  useEffect(() => {
    let isMounted = true; // Track the mounted status
  
    async function initializeEightSleep() {
      if (isMounted) {
        const tempInstance = new EightSleep(email, pword, c_id, c_secret);
        setInstance(tempInstance);
        await tempInstance.start();
      }
    }
  
    initializeEightSleep();
  
    return () => {
      isMounted = false; // Clean up the mounted status on unmount
    };
  }, []);

  useEffect(() => {
    // Make sure to remove the existing task before setting up a new one
    ReactNativeForegroundService.remove_task('heatingTask');
    // Now define the task with the latest value of standby
    ReactNativeForegroundService.add_task(() => manageHeating(instance, standby,level), {
      delay: standby * 60000,
      onLoop: true,
      taskId: 'heatingTask',
      onError: (e) => console.error('Error managing heating:', e),
    });
    // Clean up by removing the task when the component unmounts or before re-adding it
    return () => ReactNativeForegroundService.remove_task('heatingTask');
  }, [standby, instance,level]); // Add standby and instance to the dependency array


  const manageHeating = async (eightSleepInstance,standby,level) => {
    try {
      setOutputMessage('Running cycle cooling');
      // Set heating level
      await eightSleepInstance.setHeatingLevel(level, userId);
      // Determine the timeout duration based on whether it's the first loop or not
      const coolDuration = firstLoop ? coolingTime * 60000 : 2 * 60000; // 10 minutes for the first loop, 2 minutes for subsequent loops
      console.log(`waiting ${firstLoop ? `${coolingTime} minutes` : '1 minutes'}`);
      // The following will execute the code after the 2 mins has past
      setTimeout(async () => {
        await eightSleepInstance.turnOffSide(userId);
        setOutputMessage(`Standing by for ${standby} minutes`);
        // After the first loop is completed, set firstLoop to false
        setFirstLoop(false);
      }, coolDuration);      

    } catch (error) {
      console.error('Error in manageHeating:', error);
    }
  };

  // Start the foreground service
  const startService = () => {
    setFirstLoop(true);
    ReactNativeForegroundService.start({
      id: 1244,
      title: 'Sleep Eight',
      message: 'Cycle cooling active',
      icon: "ic_foreground",
      button: true,
      buttonText: "Open",
    });
  };

  // Stop the foreground service and heating tasks
  const stopService = async () => {
    setOutputMessage('Stopping EightSleep');
    ReactNativeForegroundService.stopAll();
    await instance.turnOffSide(userId);
    await instance.stop();
    setInstance(null);
    setOutputMessage('Good Morning');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
      backgroundColor: '#222'
    },
    setting: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 10,
    },
    label: {
      color: 'white',
      fontSize: 22,
      marginVertical: 10,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 20,
    },
    buttonContainer: {
      padding: 10,
      marginHorizontal: 30,
      backgroundColor: '#000', // Example gray background color
      borderColor: 'white'
    },
    buttonContainerStart: {
      padding: 10,
      marginHorizontal: 50,
      marginBottom: 20,
      backgroundColor: '#539ac9', // Example gray background color
      borderRadius: 5,
      alignItems: 'center',
      borderColor: 'white'
    },
    buttonContainerStop: {
      padding: 10,
      marginHorizontal: 50,
      backgroundColor: '#808080', // Example gray background color
      borderRadius: 5,
      alignItems: 'center',
      borderColor: 'white',
      textAlign: 'center'
    },
    buttonText: {
      fontSize: 32, // Set your desired font size here
      color: '#fff', // Example text color
    },
    value: {
      color: 'white',
      fontSize: 36,
      width: 60,
      textAlign: 'center'
    },
    outputMessage: {
      position: 'absolute', // This will position the text at the bottom
      bottom: 10, // This will give a little space at the bottom
      left: 10, // Optional: you can give it some space from the left as well
      right: 10, // Optional: you can give it some space from the right
      textAlign: 'center', // This will center the text
      fontSize: 22,
      color: '#fff',
      marginBottom: 20,
  },
  });

  const StyledButton = ({ title, onPress }) => (
    <TouchableOpacity style={styles.buttonContainer} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );

  const StyledButtonStart = ({ title, onPress }) => (
    <TouchableOpacity style={styles.buttonContainerStart} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );

  const StyledButtonStop = ({ title, onPress }) => (
    <TouchableOpacity style={styles.buttonContainerStop} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      
      <Text style={styles.label}>Level</Text> 
      <View style={styles.buttonRow}>      
        <StyledButton title="-" onPress={() => setLevel(level - 1)} />
        <Text style={styles.value}>{level}</Text>
        <StyledButton title="+" onPress={() => setLevel(level + 1)} />
      </View>

     <Text style={styles.label}>Initial cooling time</Text>
      <View style={styles.buttonRow}>
        <StyledButton color="gray" title="-" onPress={() => setCoolingTime(Math.max(0, coolingTime - 5))} />
        <Text style={styles.value}>{coolingTime}</Text>
        <StyledButton title="+" onPress={() => setCoolingTime(coolingTime + 5)} />
      </View>

      <Text style={styles.label}>Cycle standby</Text>
      <View style={styles.buttonRow}>
        <StyledButton title="-" onPress={() => setStandby(Math.max(0, standby - 5))} />
        <Text style={styles.value}>{standby}</Text>
        <StyledButton title="+" onPress={() => setStandby(standby + 5)} />
      </View>

      <StyledButtonStart title="Start" onPress={startService} />
      <StyledButtonStop title="Stop" onPress={stopService} />
      <Text style={styles.outputMessage}>{outputMessage}</Text>
      
    </View>
  );
  };