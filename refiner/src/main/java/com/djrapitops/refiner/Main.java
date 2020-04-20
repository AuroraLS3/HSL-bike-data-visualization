package com.djrapitops.refiner;

import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import com.google.gson.TypeAdapter;

import java.io.File;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;

public class Main {

    public static void main(String[] args) throws Exception {
        Path dataDir = new File("").toPath().toAbsolutePath().getParent()
                .resolve("data");

        Path writeDir = dataDir.resolve("json-grouped");
        Files.createDirectories(writeDir);

        Files.list(dataDir.resolve("json")).parallel().forEach(jsonFile -> {
            try {
                System.out.println("Processing: " + jsonFile.toFile().getAbsolutePath());
                Files.write(writeDir.resolve(jsonFile.getFileName()), Collections.singletonList(parse(jsonFile)));
            } catch (IOException e) {
                throw new UncheckedIOException("Fail: '" + jsonFile.toFile().getAbsolutePath() + "'", e);
            } catch (ParseException | JsonParseException e) {
                throw new IllegalStateException("Fail: '" + jsonFile.toFile().getAbsolutePath() + "'", e);
            }
        });
        System.out.println("\nProcessing complete.");
    }

    private static String parse(Path jsonFile) throws IOException, ParseException {
        StringBuilder read = new StringBuilder();
        try (Stream<String> lines = Files.lines(jsonFile)) {
            lines.forEach(read::append);
        }
        TypeAdapter<Series> seriesAdapter = new Gson().getAdapter(Series.class);
        Series series = seriesAdapter.fromJson(read.toString());

        SimpleDateFormat originalFormat = new SimpleDateFormat("yyyy'/'MM'/'dd HH:mm:ss");
        SimpleDateFormat hourFormat = new SimpleDateFormat("yyyy'/'MM'/'dd HH':00:00'");
        Map<Long, Average> groupedByHour = new TreeMap<>();
        for (Point point : series.getPoints()) {
            long millis = originalFormat.parse(point.date).toInstant()
                    .truncatedTo(ChronoUnit.HOURS)
                    .toEpochMilli();
            groupedByHour.computeIfAbsent(millis, key -> new Average())
                    .add(point.value);
        }

        Series groupedSeries = new Series(series.id, hourFormat, groupedByHour);
        return seriesAdapter.toJson(groupedSeries);
    }

    public static class Series {
        String id;
        private Object[][] series;

        public Series(String id, SimpleDateFormat hourFormat, Map<Long, Average> groupedByHour) {
            this.id = id;
            this.series = groupedByHour.entrySet().stream()
                    .map(entry -> {
                        String date = hourFormat.format(entry.getKey());
                        double average = entry.getValue().get();
                        return new Object[]{date, average};
                    }).toArray(Object[][]::new);
        }

        public Point[] getPoints() {
            return Arrays.stream(series).map(p -> new Point((String) p[0], (double) p[1])).toArray(Point[]::new);
        }
    }

    public static class Point {
        String date;
        double value;

        public Point(String date, double value) {
            this.date = date;
            this.value = value;
        }
    }

    public static class Average {
        private double total = 0.0;
        private int count = 0;

        public void add(double value) {
            total += value;
            count++;
        }

        public double get() {
            return count != 0 ? total / count : 0.0;
        }
    }
}
