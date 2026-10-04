import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { appStyles, colors } from '../utils/theme';

export function ActorLibraryScreen() {
  const server=useServerLibrary(); const local=useLocalLibrary();
  const frameVideos=[...local.videos,...server.videos.filter(video=>video.isDownloaded)];
  const [name,setName]=useState(''); const [image,setImage]=useState<{base64:string;mime:string;uri:string}|null>(null);
  const [busy,setBusy]=useState(false); const [editing,setEditing]=useState<number|undefined>();
  async function chooseImage(){
    const result=await DocumentPicker.getDocumentAsync({type:'image/*',copyToCacheDirectory:true});
    if(result.canceled) return;
    const asset=result.assets[0]; const file=new File(asset.uri);
    setImage({base64:await file.base64(),mime:asset.mimeType??'image/jpeg',uri:asset.uri});
  }
  async function captureFrame(uri:string){
    try { const frame=await VideoThumbnails.getThumbnailAsync(uri,{time:2000,quality:0.9}); const file=new File(frame.uri); setImage({base64:await file.base64(),mime:'image/jpeg',uri:frame.uri}); }
    catch { Alert.alert('Could not capture frame','Choose a local video file that this device can open.'); }
  }
  async function save(){
    if(!server.connected){Alert.alert('Connect to server','Connect to your Streamy server to create shared actor profiles.');return;}
    if(!name.trim()) return;
    setBusy(true); try { await server.saveActor(name.trim(),image?.base64,image?.mime,editing); setName('');setImage(null);setEditing(undefined); }
    catch(error){Alert.alert('Could not save actor',error instanceof Error?error.message:'Please try again.');} finally{setBusy(false);}
  }
  function edit(actorId:number,actorName:string){setEditing(actorId);setName(actorName);setImage(null);}
  async function remove(actorId:number){try{await server.deleteActor(actorId);}catch(error){Alert.alert('Could not remove actor',error instanceof Error?error.message:'Please try again.');}}
  return <SafeAreaView style={appStyles.screen}><ScrollView contentContainerStyle={appStyles.pageContent}>
    <Text style={appStyles.sectionTitle}>Actor library</Text>
    <Text style={appStyles.sectionMeta}>Actor profiles are shared with your web library. Pick an image or capture a frame from a local video.</Text>
    {!server.connected?<Text style={[appStyles.sectionMeta,{color:colors.accent}]}>Connect to your server in Profile to manage shared actors.</Text>:null}
    <TextInput value={name} onChangeText={setName} style={appStyles.searchInput} placeholder="Actor name" placeholderTextColor={colors.textMuted}/>
    <View style={{flexDirection:'row',gap:10,marginTop:12}}>
      <Pressable onPress={()=>void chooseImage()} style={appStyles.secondaryButton}><Text style={appStyles.secondaryButtonText}>Upload image</Text></Pressable>
      {editing?<Pressable onPress={()=>{setEditing(undefined);setName('');setImage(null);}} style={appStyles.secondaryButton}><Text style={appStyles.secondaryButtonText}>Cancel edit</Text></Pressable>:null}
    </View>
    {image?<Image source={{uri:image.uri}} style={{width:88,height:88,borderRadius:44,marginTop:14}}/>:null}
    {!!frameVideos.length&&!editing?<><Text style={[appStyles.sectionTitle,{marginTop:22}]}>Capture from a local video</Text>{frameVideos.slice(0,30).map(video=><Pressable key={video.id} onPress={()=>void captureFrame(video.video)} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:13,borderBottomWidth:1,borderBottomColor:colors.border}}><Text numberOfLines={1} style={[appStyles.videoDescriptionText,{flex:1}]}>{video.title}</Text><Ionicons name="camera-outline" size={20} color={colors.accent}/></Pressable>)}</>:null}
    <Pressable disabled={busy||!server.connected} style={[appStyles.primaryButton,{marginTop:18,opacity:busy||!server.connected?0.55:1}]} onPress={()=>void save()}><Text style={appStyles.primaryButtonText}>{busy?'Saving…':editing?'Save actor':'Create actor'}</Text></Pressable>
    <Text style={[appStyles.sectionTitle,{marginTop:30}]}>Actors</Text>
    {server.actors.map(actor=><View key={actor.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,borderBottomWidth:1,borderBottomColor:colors.border}}>
      {actor.profile_image?<Image source={{uri:actor.profile_image}} style={{width:46,height:46,borderRadius:23}}/>:<View style={{width:46,height:46,borderRadius:23,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="person" size={22} color={colors.textMuted}/></View>}
      <Text style={[appStyles.videoDescriptionText,{flex:1}]}>{actor.name}</Text><Pressable onPress={()=>edit(actor.id,actor.name)}><Ionicons name="create-outline" size={21} color={colors.textMuted}/></Pressable><Pressable onPress={()=>Alert.alert('Delete actor?',`Remove ${actor.name} from videos?`,[{text:'Cancel'},{text:'Delete',style:'destructive',onPress:()=>void remove(actor.id)}])}><Ionicons name="trash-outline" size={20} color={colors.accent}/></Pressable>
    </View>)}
    {!server.actors.length?<Text style={appStyles.sectionMeta}>No actor profiles yet.</Text>:null}
  </ScrollView></SafeAreaView>;
}
