import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString } from 'geojson';
import { StyleSheet } from 'react-native';

export function WalkMap({ route, center }: { route: FeatureCollection<LineString>; center?: [number, number] }) {
  return (
    <Map style={styles.map} mapStyle="https://tiles.openfreemap.org/styles/liberty">
      <Camera initialViewState={{ center: [77.5946, 12.9716], zoom: 14 }} center={center} />
      <GeoJSONSource id="recorded-route" data={route}>
        <Layer id="recorded-route-line" type="line" paint={{ 'line-color': '#52684B', 'line-width': 5 }} />
      </GeoJSONSource>
      {center && (
        <GeoJSONSource id="last-saved-position" data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: center } }}>
          <Layer id="last-saved-position-dot" type="circle" paint={{ 'circle-color': '#A6573F', 'circle-radius': 7, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }} />
        </GeoJSONSource>
      )}
    </Map>
  );
}
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 200 } });
