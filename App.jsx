import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet,TouchableOpacity } from 'react-native';
import EightSleep from './src/EightSleep';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

const email =
const pword = 
const c_id = 
const c_secret =
const userId = 


export default function App() {
  
  const [instance, setInstance] = useState(null);
  const [initialCoolingTime, setInitialCoolingTime] = useState(30);
  const [standby, setStandby] = useState(30);
  const [level, setLevel] = useState(3);
  const [outputMessage, setOutputMessage] = useState('');
  const [outputLevel, setOutputLevel] = useState('Getting temp...');
  const firstLoopRef = useRef(true);
  const [lastLevel, setLastLevel] = useState(null); // State to keep track of the last fetched level
  const [coolDownTimeoutId, setCoolDownTimeoutId] = useState(null);
  const [countdownTime, setCountdownTime] = useState(0);
  const [countdownIntervalId, setCountdownIntervalId] = useState(null);


  useEffect(() => {
    if (instance) {
      const intervalId = setInterval(() => {
        instance.getUserData(userId)
          .then(currentLevel => {
            // Only update the state if the level has changed
            if (lastLevel !== currentLevel) {
              setOutputLevel(`Current Level: ${currentLevel}`);
              setLastLevel(currentLevel); // Update lastLevel state
            }
          })
          .catch(error => {
            console.error('Error fetching user data:', error);
          });
      }, 20* 1000); // 20 seconds interval

      // Cleanup interval on component unmount
      return () => clearInterval(intervalId);
    }
  }, [instance, lastLevel]);

  useEffect(() => {
    console.log('use effect 1 mounted')
    let isMounted = true; // Track the mounted status
  
    async function initializeEightSleep() {
      if (isMounted) {
        const tempInstance = new EightSleep(email, pword, c_id, c_secret);
        setInstance(tempInstance);
        await tempInstance.start();
        console.log('started instance of eight sleep')
      }
    }
  
    if (!instance) {
      initializeEightSleep();
  }
  
    return () => {
      isMounted = false; // Clean up the mounted status on unmount
    };
  }, [instance]);

  useEffect(() => {
    // Check if instance is not null
    if (instance) {
      // the first loop delay needs to be standby + coolduration to give extra time for the cooling.
      const coolDuration = firstLoopRef.current ? initialCoolingTime : 1 ;
      const effectiveStandby = standby + coolDuration;
      console.log(`effective standby is ${effectiveStandby}`);
      // Make sure to remove the existing task before setting up a new one
      ReactNativeForegroundService.remove_task('heatingTask');
  
      // Define the task with the latest value of standby
      ReactNativeForegroundService.add_task(() => manageHeating(instance, standby, level), {
        delay: effectiveStandby * 60000,
        onLoop: true,
        taskId: 'heatingTask',
        onError: (e) => console.error('Error managing heating:', e),
      });

      // Return a cleanup function
      return () => ReactNativeForegroundService.remove_task('heatingTask');
    }
  }, [standby, instance, level,firstLoopRef.current]);


  const manageHeating = async (eightSleepInstance,standby,level) => {
    try {
      if (firstLoopRef.current) {
        setOutputMessage('Running initial cooling');
      } else {
        setOutputMessage('Running cycle cooling');
      }

      // Set heating level
      await eightSleepInstance.setHeatingLevel(level, userId);
      console.log('Set heating level')
      console.log(`first loop is ${firstLoopRef.current}`)
      // Determine the timeout duration based on whether it's the first loop or not
      const coolDuration = firstLoopRef.current ? initialCoolingTime  : 1 ; // 10 minutes for the first loop, 2 minutes for subsequent loops
      console.log(`waiting ${firstLoopRef.current ? `${initialCoolingTime} minutes` : '1 minutes'}`);
      

          // Clear existing interval if any
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
      }
      // Set countdown for cooling duration
      setCountdownTime(coolDuration * 60); // coolDuration in minutes to seconds

          // Setup countdown timer
      const intervalId = setInterval(() => {
        setCountdownTime(prevTime => {
          if (prevTime > 0) {
            return prevTime - 1;
          } else {
            clearInterval(intervalId);
            return 0;
          }
        });
      }, 1000); // Update every second

      setCountdownIntervalId(intervalId);


      // The following will execute the code after the duration has past
      const timeoutId = setTimeout(async () => {
        await eightSleepInstance.turnOffSide(userId);
        console.log('Turned off heat')
        setOutputMessage(`Standing by for ${standby} minutes`);
        // After the first loop is completed, set firstLoop to false
        firstLoopRef.current = false; //Changing this to false will trigger useEffect to change the effectiveStandby time for cycle cooling. 
        console.log(`first loop is ${firstLoopRef.current}`)
        console.log('waiting for standby time')
        setCountdownTime(standby * 60); // Reset the countdown timer

        // Reset the countdown timer for standby time
        setCountdownTime(standby * 60); // Reset for standby duration

        // Clear and reset interval for standby countdown
        clearInterval(intervalId);
        const standbyIntervalId = setInterval(() => {
          setCountdownTime(prevTime => {
            if (prevTime > 0) {
              return prevTime - 1;
            } else {
              clearInterval(standbyIntervalId);
              return 0;
            }
          });
        }, 1000);

        setCountdownIntervalId(standbyIntervalId);

      }, coolDuration*60000);

      setCoolDownTimeoutId(timeoutId);
    } catch (error) {
      console.error('Error in manageHeating:', error);
    }
  };

  // Start the foreground service
  const startService = () => {
    console.log('starting service and setting loop to true')
    ReactNativeForegroundService.start({
      id: 1244,
      title: 'Sleep Eight',
      message: 'Cycle cooling active',
      icon: "ic_foreground",
      button: true,
      buttonText: "Open",
    });
  };

  const skipStandby = () => {
    if (coolDownTimeoutId) {
      clearTimeout(coolDownTimeoutId); // Clear the current timeout
      manageHeating(instance, standby, level); // Start the next loop immediately
    }
  };

  // Stop the foreground service and heating tasks
  const stopService = async () => {
    setOutputMessage('Stopping EightSleep');
    ReactNativeForegroundService.stopAll();
    if (instance) {
      await instance.turnOffSide(userId);
      await instance.stop();
    }
    setInstance(null);
    setOutputMessage('Good Morning');
    firstLoopRef.current = true;
      // Reset and clear the countdown timer
    setCountdownTime(0);
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      setCountdownIntervalId(null);
  }
  };

  // Function to determine the color of the outputLevel based on its value
  const getOutputLevelStyle = () => {
    // Assuming outputLevel contains a string like "Current Level: 3"
    // Extract the numerical value from this string
    const levelValue = parseInt(outputLevel.replace(/[^\d-]/g, ''), 10); // Updated regex to allow negative sign (-)
    let color;
    if (isNaN(levelValue)) {
      color = 'white'; // If levelValue is NaN, set color to white
    } else {
      color = levelValue < 2 ? '#539ac9' : '#c25d5d'; // Else use the conditional color based on levelValue
    }   

    return {
      fontSize: 22, 
      color: color,
      position: 'absolute', 
      top: 30, 
      left: 100, 
      right: 100, 
      textAlign: 'center',
      borderWidth: 1,
      borderColor: 'white',
      borderRadius: 5,
      padding: 5, 
      marginBottom: 10,
    };
  };


  useEffect(() => {
    // ... existing useEffect code ...
  
    return () => {
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
      }
    };
  }, [countdownIntervalId]);
  
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
      backgroundColor: '#000'
    },
    setting: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 10,
    },
    timer: {
      marginTop: 10,
      textAlign: 'center',
      color: 'white',
      marginHorizontal: 50,
      padding: 5,
      fontSize: 16,
      borderWidth: 1,
      borderColor: 'white',
      borderRadius: 5,

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
      backgroundColor: '#222', 
      borderColor: 'white',
      borderRadius: 50,
    },
    buttonContainerStart: {
      padding: 10,
      marginTop: 20,
      marginHorizontal: 120,
      backgroundColor: '#4f9c3e',
      borderRadius: 50,
      alignItems: 'center',
      borderColor: 'white'
    },
    buttonContainerStop: {
      padding: 10,
      marginHorizontal: 120,
      marginTop: 10,
      backgroundColor: '#c74646', 
      borderRadius: 50,
      alignItems: 'center',
      borderColor: 'white',
      textAlign: 'center',
    },

    buttonContainerCycle: {
      padding: 10,
      marginTop: 10,
      backgroundColor: '#539ac9', // light blue
      marginHorizontal: 120,
      borderRadius: 50,
      alignItems: 'center',
      borderColor: 'white',
      textAlign: 'center'
    },

    buttonText: {
      fontSize: 26,
      color: '#fff',
    },
    value: {
      color: 'white',
      fontSize: 32,
      width: 60,
      textAlign: 'center'
    },
    outputMessage: {
      marginTop: 20,
      textAlign: 'center', 
      fontSize: 22,
      color: '#fff',
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

  const StyledButtonCycle = ({ title, onPress }) => (
    <TouchableOpacity style={styles.buttonContainerCycle} onPress={onPress}>
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
        <StyledButton color="gray" title="-" onPress={() => setInitialCoolingTime(Math.max(0, initialCoolingTime - 5))} />
        <Text style={styles.value}>{initialCoolingTime}</Text>
        <StyledButton title="+" onPress={() => setInitialCoolingTime(initialCoolingTime + 5)} />
      </View>

      <Text style={styles.label}>Cycle standby</Text>
      <View style={styles.buttonRow}>
        <StyledButton title="-" onPress={() => setStandby(Math.max(0, standby - 5))} />
        <Text style={styles.value}>{standby}</Text>
        <StyledButton title="+" onPress={() => setStandby(standby + 5)} />
      </View>

      <StyledButtonStart title="Start" onPress={startService} />
      <StyledButtonStop title="Stop" onPress={stopService} />
      <StyledButtonCycle title="Refresh" onPress={skipStandby} />

      <Text style={styles.outputMessage}>{outputMessage}</Text>

      <Text style={getOutputLevelStyle()}>{outputLevel}</Text>

      {countdownTime > 0 && (
      <Text style={styles.timer}>Countdown: {formatTime(countdownTime)}</Text>
      )}
      
    </View>
  );
  };