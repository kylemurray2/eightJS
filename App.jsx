import React, { useState, useRef } from 'react';
import { View, Text, Button, StyleSheet,TouchableOpacity } from 'react-native';
import EightSleep from './src/EightSleep';
import 'dotenv/config';

// 
const email = process.env.EIGHTSLEEP_EMAIL;
const pword = process.env.EIGHTSLEEP_PWORD;
const c_id = process.env.EIGHTSLEEP_C_ID;
const c_secret = process.env.EIGHTSLEEP_C_SECRET;
const userId = process.env.EIGHTSLEEP_USER_ID;


const App = () => {
  const [level, setLevel] = useState(1);
  const [coolingTime, setCoolingTime] = useState(30);
  const [standby, setStandby] = useState(30);

  const [outputMessage, setOutputMessage] = useState('');

  const [message, setMessage] = useState('');
  const [sleep, setSleep] = useState(null);
  const [running, setRunning] = useState(true);

  const runningRef = useRef(true);

  const handleStart = async () => {
    setOutputMessage('Starting EightSleep');
    runningRef.current = true;

    try {
     
        const instance = new EightSleep(email, pword, c_id, c_secret);
        setSleep(instance);
        await instance.start();
      
        // Do the initial cooling
        setOutputMessage('Running initial cooling');
        console.log('Initial cooling to ' + level);
        await instance.setHeatingLevel(level, userId);
        console.log('waiting ' + coolingTime + ' minutes.');
        await new Promise(resolve => setTimeout(resolve, coolingTime * 1000*60));
        console.log('Done with initial cooling');
        await instance.turnOffSide(userId);
        setOutputMessage('Running cycle cooling');

      //   await instance.setHeatingLevel(1, userId); 
        while (runningRef.current) {
          console.log('Cycle cooling to ' + level);
          await instance.setHeatingLevel(level, userId);
          console.log('waiting ' + Math.round(2) + ' minutes.');
          await new Promise(resolve => setTimeout(resolve, 2 * 1000*60));
          console.log('turning off');
          await instance.turnOffSide(userId);
          console.log('waiting ' + Math.round(standby) + ' minutes.');
          await new Promise(resolve => setTimeout(resolve, standby * 1000*60));
           // Check if running is still true, otherwise break out of the loop
           console.log(runningRef.current)
           if (!runningRef.current) {
             console.log('Exiting because running is false')
             break;
           }
      }
    
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setMessage(`Error: ${errorMessage}`);
    }
  };

  const handleStop = async () => {
    setOutputMessage('Stopping EightSleep');
    runningRef.current = false; // Update the runningRef value to false here
    await sleep.turnOffSide(userId);
    await sleep.stop();
    setSleep(null);
    setOutputMessage('Good morning');

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
        <StyledButton title="-" onPress={() => setLevel(Math.max(0, level - 1))} />
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

      <StyledButtonStart title="Start" onPress={handleStart} />
      <StyledButtonStop title="Stop" onPress={handleStop} />
      <Text style={styles.outputMessage}>{outputMessage}</Text>
      
    </View>
  );

};

export default App;
