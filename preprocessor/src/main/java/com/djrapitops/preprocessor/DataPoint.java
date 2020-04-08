package com.djrapitops.preprocessor;

public class DataPoint {

    String id;
    String time;
    String availableBikes;
    String spacesAvailable;

    public DataPoint(String id, String time, String availableBikes, String spacesAvailable) {
        this.id = id;
        this.time = time;
        this.availableBikes = availableBikes;
        this.spacesAvailable = spacesAvailable;
    }

    public String toArrayString() {
        return "[\"" + time + "\", " + availableBikes + "," + spacesAvailable + "]";
    }
}
