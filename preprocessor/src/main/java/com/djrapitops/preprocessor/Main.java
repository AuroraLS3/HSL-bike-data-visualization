package com.djrapitops.preprocessor;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class Main {

    public static void main(String[] args) throws Exception {
        Path dataDir = new File("").toPath().toAbsolutePath().getParent()
                .resolve("data");

        Path writeDir = dataDir.resolve("json");
        Files.createDirectories(writeDir);
        for (String fileName : Arrays.asList("data_2017.csv", "data_2018.csv", "data_2019.csv")) {
            parse(writeDir, dataDir.resolve("csv").resolve(fileName), fileName.substring(5, 9));
        }
    }

    private static void parse(Path dir, Path file, String year) throws IOException {
        Map<String, StringBuilder> parser = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        System.out.println("Parsing lines of " + file.toString());
        try (Stream<String> lines = Files.lines(file)) {
            lines.forEach(line -> {
                String[] row = line.split(";");
                String id = row[0].trim();
                if (id.contains("NA") || id.contains("id")) {
                    return;
                }
                DataPoint dataPoint = new DataPoint(id, row[7].trim(), row[1].trim(), row[2].trim());
                parser.computeIfAbsent(dataPoint.id, key -> new StringBuilder("{\"id\":\"" + dataPoint.id + "\",\"series\":["))
                        .append(",").append(dataPoint.toArrayString()); // adds an extra , at the start of the array
            });
        }
        System.out.println("Parsing complete, parsed data for " + parser.size() + " stations");
        for (String key : new ArrayList<>(parser.keySet())) {
            Path writeTo = dir.resolve("data-" + key + "-" + year + ".json");
            Files.deleteIfExists(writeTo);
            Files.createFile(writeTo);
            System.out.println("Writing " + writeTo.toFile().getName() + "..");
            try (PrintStream fileStream = new PrintStream(writeTo.toFile())) {
                StringBuilder line = parser.get(key);
                parser.remove(key);

                try {
                    // Remove preceding , from line 36
                    StringBuilder ready = line.deleteCharAt(line.indexOf("[") + 1).append("]}");
                    fileStream.println(ready.toString());
                    fileStream.flush();
                } catch (OutOfMemoryError e) {
                    System.out.println("Failure copying length: " + line.length());
                    throw e;
                }
            }
        }
    }
}
